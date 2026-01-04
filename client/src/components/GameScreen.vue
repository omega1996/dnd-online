<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import BoardCanvas from "./BoardCanvas.vue";
import { useAuth } from "../composables/useAuth";
import { useCharacters } from "../composables/useCharacters";
import { useNPCs } from "../composables/useNPCs";
import { useGameStore } from "../stores/gameStore";
import CharacterViewModal from "./CharacterViewModal.vue";
import CreateCharacterModal from "./CreateCharacterModal.vue";
import CharacterCard from "./CharacterCard.vue";
import NPCCard from "./NPCCard.vue";
import CreateNPCModal from "./CreateNPCModal.vue";
import NPCViewModal from "./NPCViewModal.vue";
import GameLogs from "./GameLogs.vue";
import DiceRoller from "./DiceRoller.vue";
import TokenContextMenu from "./TokenContextMenu.vue";
import DamageModal from "./DamageModal.vue";
import { buildApiUrl, buildAssetUrl } from "../utils/api.js";
import * as webrtcAudio from "../webrtcAudio.js";

const props = defineProps({
  serverUrl: {
    type: String,
    required: true,
  },
  roomCode: {
    type: String,
    required: true,
  },
  members: {
    type: Array,
    required: true,
  },
  me: {
    type: String,
    required: true,
  },
  myRole: {
    type: String,
    required: true,
  },
  roomState: {
    type: Object,
    required: true,
    default: () => ({ map: null, tokens: {} }),
  },
  pendingCharacterToken: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["leave", "token-move", "action", "character-token-added", "hide-token", "show-token"]);

// Авторизация
const { logout, user } = useAuth();
const { characters, fetchCharacters, loading: charactersLoading, getCharacterByIdReadOnly } = useCharacters();
const { npcs, fetchNPCs, loading: npcsLoading, deleteNPC } = useNPCs();

// Game store
const gameStore = useGameStore();

// Модальное окно просмотра персонажа
const selectedCharacter = ref(null);
const loadingCharacter = ref(false);
const showCreateCharacterModal = ref(false);

// Модальное окно для NPC
const showCreateNPCModal = ref(false);
const npcToEdit = ref(null);
const showNPCViewModal = ref(false);
const selectedNPC = ref(null);

// Модальное окно подтверждения удаления токена
const showDeleteTokenModal = ref(false);
const tokenToDelete = ref(null);

// Контекстное меню токена
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedTokenId = ref(null);

// Модальное окно урона
const showDamageModal = ref(false);
const damageTokenId = ref(null);

// Форма добавления токена (для мастера)
const showAddTokenForm = ref(false);
const newTokenFile = ref(null);
const newTokenOwnerId = ref("");
const isUploading = ref(false);

// Форма загрузки карты (для мастера)
const showSetMapForm = ref(false);
const newMapFile = ref(null);
const isUploadingMap = ref(false);
const gridRows = ref(10);
const gridColumns = ref(16);

// WebRTC audio sharing
const isSharingAudio = ref(false);
const audioSharingError = ref(null);

// Computed для карты и токенов
const mapSrc = computed(() => props.roomState?.map?.src || null);
const tokens = computed(() => props.roomState?.tokens || {});
const gameLogs = computed(() => props.roomState?.logs || []);
const mapGrid = computed(() => props.roomState?.map?.grid || { rows: 10, columns: 10, enabled: true });

// Размеры для игрового поля в соотношении 16:9
const gameAreaHeight = ref(0);
const gameAreaWidth = ref(0);
const sidebarWidth = 350; // Ширина сайдбара
const statusBarRef = ref(null);

// Вычисление размеров игрового поля
function calculateGameAreaSize() {
  // Получаем реальную высоту статус бара
  const statusBarHeight = statusBarRef.value?.offsetHeight || 60;
  const availableHeight = window.innerHeight - statusBarHeight;
  const availableWidth = window.innerWidth - sidebarWidth;

  // Вычисляем ширину из соотношения 16:9
  const widthFromHeight = availableHeight * (16 / 9);

  // Вычисляем высоту из соотношения 16:9
  const heightFromWidth = availableWidth * (9 / 16);

  // Выбираем меньший размер, чтобы все поместилось
  if (widthFromHeight <= availableWidth) {
    // Высота ограничивает размер
    gameAreaHeight.value = availableHeight;
    gameAreaWidth.value = widthFromHeight;
  } else {
    // Ширина ограничивает размер
    gameAreaWidth.value = availableWidth;
    gameAreaHeight.value = heightFromWidth;
  }

  console.log("[GameScreen] Calculated game area size:", {
    width: gameAreaWidth.value,
    height: gameAreaHeight.value,
    availableWidth,
    availableHeight,
    statusBarHeight,
  });
}

// Обработчик изменения размера окна
function handleResize() {
  calculateGameAreaSize();
}

// Computed для списка участников для выбора владельца
const membersForOwnerSelect = computed(() => {
  return props.members.map((m) => ({ id: m.id, name: m.name, role: m.role }));
});

function sendAction(type, payload) {
  emit("action", { type, payload });
}

// Генерация уникального ID для токена
function generateTokenId() {
  return `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Загрузка файла на сервер
async function uploadTokenImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(buildApiUrl(props.serverUrl, "/upload-token-image"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Failed to upload image");
  }

  const data = await response.json();
  return data.url; // Возвращаем URL вида /uploads/filename.png
}

// Загрузка карты на сервер
async function uploadMapImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(buildApiUrl(props.serverUrl, "/upload-map-image"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Failed to upload image");
  }

  const data = await response.json();
  return data.url; // Возвращаем URL вида /uploads/filename.png
}

// Добавление токена (для мастера)
async function handleAddToken() {
  if (!newTokenFile.value) {
    alert("Please select an image file");
    return;
  }

  if (isUploading.value) return; // Предотвращаем повторные клики

  isUploading.value = true;

  try {
    // Загружаем файл на сервер
    const imageUrl = await uploadTokenImage(newTokenFile.value);

    // Полный URL для доступа к файлу
    const fullImageUrl = buildAssetUrl(props.serverUrl, imageUrl);

    const tokenId = generateTokenId();
    // Позиция на сетке (0, 0) - начальная позиция
    const gridX = 0;
    const gridY = 0;

    const payload = {
      id: tokenId,
      gridX,
      gridY,
      src: fullImageUrl,
      name: `Token ${tokenId.slice(-6)}`,
      ownerId: newTokenOwnerId.value || undefined, // Если не выбран, будет установлен socket.id мастера
    };

    sendAction("TOKEN_ADD", payload);

    // Очищаем форму
    newTokenFile.value = null;
    newTokenOwnerId.value = "";
    showAddTokenForm.value = false;
  } catch (error) {
    console.error("[GameScreen] Failed to upload token image:", error);
    alert(`Failed to upload image: ${error.message}`);
  } finally {
    isUploading.value = false;
  }
}

// Обработчик выбора файла
function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    // Проверяем тип файла
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      event.target.value = "";
      return;
    }
    // Проверяем размер (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      event.target.value = "";
      return;
    }
    newTokenFile.value = file;
  }
}

// Обработчик выбора файла карты
function handleMapFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    // Проверяем тип файла
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      event.target.value = "";
      return;
    }
    // Проверяем размер (10MB для карт)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      event.target.value = "";
      return;
    }
    newMapFile.value = file;
  }
}

// Установка карты (для мастера)
async function handleSetMap() {
  if (!newMapFile.value) {
    alert("Please select an image file");
    return;
  }

  if (isUploadingMap.value) return; // Предотвращаем повторные клики

  isUploadingMap.value = true;

  try {
    // Загружаем файл на сервер
    const imageUrl = await uploadMapImage(newMapFile.value);

    // Полный URL для доступа к файлу
    const fullImageUrl = buildAssetUrl(props.serverUrl, imageUrl);

    // Отправляем действие установки карты с параметрами сетки
    sendAction("MAP_SET", { 
      src: fullImageUrl,
      grid: {
        rows: parseInt(gridRows.value) || 10,
        columns: parseInt(gridColumns.value) || 10,
        enabled: props.roomState?.map?.grid?.enabled ?? true
      }
    });

    // Очищаем форму
    newMapFile.value = null;
    showSetMapForm.value = false;
  } catch (error) {
    console.error("[GameScreen] Failed to upload map image:", error);
    alert(`Failed to upload image: ${error.message}`);
  } finally {
    isUploadingMap.value = false;
  }
}

// Переключение отображения сетки (для мастера)
function handleToggleGrid() {
  const currentGrid = props.roomState?.map?.grid || { rows: 10, columns: 10, enabled: true };
  const newEnabled = !currentGrid.enabled;
  
  // Отправляем только обновление сетки, без изменения карты
  sendAction("MAP_SET", {
    grid: {
      rows: currentGrid.rows,
      columns: currentGrid.columns,
      enabled: newEnabled
    }
  });
}

// Обработчик перемещения токена
function handleTokenMove(tokenId, gridX, gridY) {
  emit("token-move", tokenId, gridX, gridY);
}

// Обработчик клика на токен (для просмотра персонажа)
async function handleTokenClick(tokenId) {
  if (!tokenId) return;
  
  // Находим токен на доске
  const token = tokens.value[tokenId];
  if (!token || !token.characterId) {
    console.log("Token has no characterId, cannot show character");
    return;
  }
  
  const characterId = token.characterId;
  console.log("Opening character view for characterId:", characterId);
  
  // Сначала пытаемся найти персонажа в локальном списке
  let character = characters.value.find((c) => c.id === characterId);
  
  // Если не найден локально, загружаем из Firebase (даже если это не наш персонаж)
  if (!character) {
    console.log("Character not in local list, loading from Firebase...");
    loadingCharacter.value = true;
    try {
      character = await getCharacterByIdReadOnly(characterId);
      if (!character) {
        console.warn("Character not found in Firebase, characterId:", characterId);
        alert("Персонаж не найден. Возможно, он был удален.");
        loadingCharacter.value = false;
        return;
      }
      console.log("Character loaded from Firebase successfully:", character.id);
    } catch (error) {
      console.error("Error loading character from Firebase:", error);
      alert(`Ошибка при загрузке персонажа: ${error.message}`);
      loadingCharacter.value = false;
      return;
    } finally {
      loadingCharacter.value = false;
    }
  } else {
    console.log("Character found in local list");
  }
  
  // Открываем модальное окно с информацией о персонаже
  if (character) {
    selectedCharacter.value = character;
  }
}

// Обработчик просмотра персонажа из списка
function handleViewCharacter(character) {
  selectedCharacter.value = character;
}

// Обработчик добавления токена персонажа
function handleAddCharacterToken(character) {
  // Получаем imageUrl из правильного места
  const characterImageUrl = character?.imageUrl || 
                            character?.characterData?.character?.[0]?.image_url || 
                            null;
  
  if (!character || !characterImageUrl) {
    console.error("Character data is missing");
    return;
  }

  // Генерируем уникальный ID для токена
  const tokenId = generateTokenId();
  
  // Позиция на сетке (0, 0) - начальная позиция
  const gridX = 0;
  const gridY = 0;

  // Получаем имя персонажа из новой структуры или старой
  const characterName = character?.player_name || 
                       character?.characterData?.character?.[0]?.character_name || 
                       character?.name || 
                       "Unknown";

  // Получаем hit points из структуры персонажа
  let hitPoints = null;
  if (character?.characterData?.character?.[0]?.hp?.[0]) {
    const hpData = character.characterData.character[0].hp[0];
    hitPoints = hpData.hp_current !== null ? hpData.hp_current : hpData.hp_max;
  }

  const payload = {
    id: tokenId,
    gridX,
    gridY,
    src: characterImageUrl,
    name: characterName,
    ownerId: props.me,
    characterId: character.id, // Сохраняем ID персонажа в токене
    hitPoints: hitPoints, // Сохраняем hit points токена
  };

  // Отправляем действие на сервер - токен будет добавлен в roomState.tokens
  sendAction("TOKEN_ADD", payload);
  // Не нужно обновлять Firebase - состояние токена хранится только на сервере
}

// Обработчик удаления токена с доски (показывает модальное окно подтверждения)
function handleRemoveCharacterToken(tokenId) {
  if (!tokenId) {
    console.error("Token ID is missing");
    return;
  }

  // Находим токен на доске
  const token = tokens.value[tokenId];
  if (!token) {
    console.error("Token not found on board");
    return;
  }

  // Проверяем, что токен принадлежит текущему пользователю
  if (token.ownerId !== props.me) {
    console.error("Cannot remove token: not owner");
    return;
  }
  
  // Показываем модальное окно подтверждения
  tokenToDelete.value = tokenId;
  showDeleteTokenModal.value = true;
}

// Подтверждение удаления токена
function confirmDeleteToken() {
  if (!tokenToDelete.value) {
    return;
  }
  
  // Удаляем токен с доски - отправляем действие на сервер
  sendAction("TOKEN_REMOVE", { id: tokenToDelete.value });
  
  // Закрываем модальное окно
  showDeleteTokenModal.value = false;
  tokenToDelete.value = null;
}

// Отмена удаления токена
function cancelDeleteToken() {
  showDeleteTokenModal.value = false;
  tokenToDelete.value = null;
}

// Обработчик скрытия токена
function handleHideCharacterToken(tokenId) {
  if (!tokenId) {
    console.error("Token ID is missing");
    return;
  }

  // Находим токен на доске
  const token = tokens.value[tokenId];
  if (!token) {
    console.error("Token not found on board");
    return;
  }

  // Проверяем, что токен принадлежит текущему пользователю
  if (token.ownerId !== props.me) {
    console.error("Cannot hide token: not owner");
    return;
  }
  
  // Скрываем токен - отправляем действие на сервер
  sendAction("TOKEN_HIDE", { id: tokenId });
}

// Обработчик показа токена
function handleShowCharacterToken(tokenId) {
  if (!tokenId) {
    console.error("Token ID is missing");
    return;
  }

  // Находим токен на доске
  const token = tokens.value[tokenId];
  if (!token) {
    console.error("Token not found on board");
    return;
  }

  // Проверяем, что токен принадлежит текущему пользователю
  if (token.ownerId !== props.me) {
    console.error("Cannot show token: not owner");
    return;
  }
  
  // Показываем токен - отправляем действие на сервер
  sendAction("TOKEN_SHOW", { id: tokenId });
}

// WebRTC audio sharing handlers
async function handleStartAudioSharing() {
  if (isSharingAudio.value) {
    return;
  }

  audioSharingError.value = null;
  
  try {
    if (gameStore.isGM) {
      await webrtcAudio.startGMAudioSharing(props.members, props.me);
      isSharingAudio.value = true;
    }
  } catch (error) {
    console.error('[GameScreen] Failed to start audio sharing:', error);
    audioSharingError.value = error.message || 'Failed to start audio sharing';
    isSharingAudio.value = false;
  }
}

function handleStopAudioSharing() {
  if (gameStore.isGM) {
    webrtcAudio.stopGMAudioSharing();
    isSharingAudio.value = false;
    audioSharingError.value = null;
  }
}

// Watch for member changes to create/remove peer connections (GM only)
watch(() => props.members, (newMembers, oldMembers) => {
  if (gameStore.isGM && isSharingAudio.value) {
    const oldMemberIds = new Set((oldMembers || []).map(m => m.id));
    const newMemberIds = new Set(newMembers.map(m => m.id));
    
    // Find new players that joined
    const newPlayers = newMembers.filter(m => 
      m.id !== props.me && 
      m.role === 'Player' && 
      !oldMemberIds.has(m.id)
    );
    
    // Find players that left
    const leftPlayers = (oldMembers || []).filter(m => 
      m.id !== props.me && 
      m.role === 'Player' && 
      !newMemberIds.has(m.id)
    );
    
    // Create peer connections for new players
    if (newPlayers.length > 0) {
      console.log('[GameScreen] New players joined, creating peer connections:', newPlayers);
      newPlayers.forEach(async (player) => {
        try {
          await webrtcAudio.addGMPeerConnection(player.id, props.me);
        } catch (error) {
          console.error('[GameScreen] Failed to create peer connection for new player:', error);
        }
      });
    }
    
    // Remove peer connections for players that left
    if (leftPlayers.length > 0) {
      console.log('[GameScreen] Players left, removing peer connections:', leftPlayers);
      leftPlayers.forEach((player) => {
        webrtcAudio.removeGMPeerConnection(player.id);
      });
    }
  }
}, { deep: true });

// Загружаем персонажей и NPC при монтировании
onMounted(async () => {
  await fetchCharacters();
  if (gameStore.isGM) {
    await fetchNPCs();
    // Initialize GM audio sharing with state change callback
    webrtcAudio.initGMAudioSharing(props.members, props.me, (sharing) => {
      isSharingAudio.value = sharing;
      if (!sharing) {
        audioSharingError.value = null;
      }
    });
  } else {
    // Initialize player audio receiving
    webrtcAudio.initPlayerAudioReceiving(props.me);
  }
});

// Следим за pendingCharacterToken и добавляем токен при его появлении
watch(() => props.pendingCharacterToken, (character) => {
  if (character) {
    handleAddCharacterToken(character);
    emit('character-token-added');
  }
}, { immediate: true });

// Обработчик создания персонажа
function handleCharacterCreated() {
  fetchCharacters();
}

// Обработчики для NPC
function handleAddNPCToken(npc) {
  if (!npc || !npc.imageUrl) {
    console.error("NPC data is missing");
    return;
  }

  // Генерируем уникальный ID для токена
  const tokenId = generateTokenId();
  
  // Позиция на сетке (0, 0) - начальная позиция
  const gridX = 0;
  const gridY = 0;

  const payload = {
    id: tokenId,
    gridX,
    gridY,
    src: npc.imageUrl,
    name: npc.name,
    ownerId: props.me, // GM владеет NPC токенами
    npcId: npc.id, // Сохраняем ID NPC шаблона
    isNPC: true, // Помечаем как NPC
    hitPoints: npc.stats?.maxHitPoints || 50, // Начальные HP равны максимальным
  };

  // Отправляем действие на сервер
  sendAction("TOKEN_ADD", payload);
}

function handleViewNPC(npc) {
  selectedNPC.value = npc;
  showNPCViewModal.value = true;
}

function handleCreateNPC() {
  npcToEdit.value = null;
  showCreateNPCModal.value = true;
}

function handleEditNPC(npc) {
  npcToEdit.value = npc;
  showCreateNPCModal.value = true;
}

function handleNPCCreated() {
  fetchNPCs();
}

function handleNPCUpdated() {
  fetchNPCs();
}

async function handleDeleteNPC(npc) {
  if (confirm(`Are you sure you want to delete "${npc.name}"?`)) {
    try {
      await deleteNPC(npc.id);
      await fetchNPCs();
    } catch (err) {
      alert(`Failed to delete NPC: ${err.message}`);
    }
  }
}

function handleLeave() {
  emit("leave");
}

// Обработчик броска кубика
function handleDiceRoll(sides, result) {
  sendAction("DICE_ROLL", {
    sides,
    result,
  });
}

// Обработчик кастомного броска кубика
function handleCustomDiceRoll(rollData) {
  sendAction("DICE_ROLL_CUSTOM", {
    dice: rollData.dice,
    results: rollData.results,
    modifier: rollData.modifier,
    sum: rollData.sum,
    description: rollData.description,
  });
}

// Обработчик правого клика на токен
function handleTokenRightClick(tokenId, x, y) {
  selectedTokenId.value = tokenId;
  // x и y уже являются координатами относительно viewport (clientX, clientY)
  contextMenuX.value = x;
  contextMenuY.value = y;
  contextMenuVisible.value = true;
}

// Закрытие контекстного меню
function handleCloseContextMenu() {
  contextMenuVisible.value = false;
  selectedTokenId.value = null;
}

// Обработчик выбора пункта "нанести урон" в контекстном меню
function handleDealDamage() {
  if (!selectedTokenId.value) return;
  
  const token = tokens.value[selectedTokenId.value];
  if (!token) return;
  
  damageTokenId.value = selectedTokenId.value;
  showDamageModal.value = true;
}

// Обработчик сохранения урона
function handleSaveDamage(damageAmount) {
  if (!damageTokenId.value) return;
  
  const token = tokens.value[damageTokenId.value];
  if (!token) return;
  
  // Вычисляем новые hit points
  const currentHP = token.hitPoints !== null && token.hitPoints !== undefined ? token.hitPoints : 0;
  const newHP = Math.max(0, currentHP - damageAmount);
  
  // Отправляем действие обновления токена
  sendAction("TOKEN_UPDATE", {
    id: damageTokenId.value,
    hitPoints: newHP
  });
  
  // Закрываем модальное окно
  showDamageModal.value = false;
  damageTokenId.value = null;
}

// Закрытие модального окна урона
function handleCloseDamageModal() {
  showDamageModal.value = false;
  damageTokenId.value = null;
}

async function handleLogout() {
  try {
    await logout();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// Отладочная информация и инициализация
onMounted(() => {
  console.log("[GameScreen] Mounted with props:", {
    roomCode: props.roomCode,
    members: props.members.length,
    me: props.me,
    myRole: props.myRole,
    hasRoomState: !!props.roomState,
    mapSrc: props.roomState?.map?.src,
    tokensCount: Object.keys(props.roomState?.tokens || {}).length,
  });
  // Небольшая задержка, чтобы DOM успел отрендериться
  setTimeout(() => {
    calculateGameAreaSize();
  }, 100);
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  // Clean up WebRTC resources
  webrtcAudio.cleanup();
});
</script>

<template>
  <div
    style="
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      font-family: system-ui;
      background: #fff;
      overflow: hidden;
    "
  >
    <!-- Статус бар -->
    <div
      ref="statusBarRef"
      style="
        padding: 12px 20px;
        background: #f0f0f0;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      "
    >
      <div style="display: flex; align-items: center; gap: 12px">
        <span style="font-weight: 500"
          >Room: <strong>{{ roomCode }}</strong></span
        >
        <span
          style="
            padding: 4px 8px;
            background: #e0e0e0;
            border-radius: 4px;
            font-size: 12px;
          "
        >
          {{ myRole }}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px">
        <button
          @click="handleLeave"
          style="
            padding: 8px 16px;
            border-radius: 6px;
            border: 1px solid #ccc;
            background: white;
            cursor: pointer;
            font-weight: 500;
          "
        >
          Leave Room
        </button>
        <button
          @click="handleLogout"
          style="
            padding: 8px 16px;
            border-radius: 6px;
            border: 1px solid #ccc;
            background: white;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            color: #666;
          "
          title="Sign out"
        >
          Sign Out
        </button>
      </div>
    </div>

    <!-- Основной контент: карта и логи слева, панель справа -->
    <div
      style="
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
        justify-content: center;
        align-items: flex-start;
      "
    >
      <!-- Левая колонка: карта и логи -->
      <div
        style="
          display: flex;
          flex-direction: column;
          border-right: 1px solid #ddd;
          flex-shrink: 0;
        "
      >
        <!-- Карта -->
        <div
          :style="{
            width: `${gameAreaWidth}px`,
            height: `${gameAreaHeight}px`,
            minWidth: 0,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            flexShrink: 0,
          }"
        >
          <BoardCanvas
            :map-src="mapSrc"
            :tokens="tokens"
            :map-grid="mapGrid"
            :on-token-move="handleTokenMove"
            :on-token-click="handleTokenClick"
            :on-token-right-click="handleTokenRightClick"
          />
        </div>
        
        <!-- Настройки под картой (только для GM) -->
        <div
          v-if="gameStore.isGM"
          :style="{
            width: `${gameAreaWidth}px`,
            padding: '12px 16px',
            background: '#f9f9f9',
            borderTop: '1px solid #ddd',
            flexShrink: 0,
          }"
        >
          <label
            style="
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              user-select: none;
            "
          >
            <input
              type="checkbox"
              :checked="roomState?.map?.grid?.enabled ?? true"
              @change="handleToggleGrid"
              style="
                width: 18px;
                height: 18px;
                cursor: pointer;
              "
            />
            <span style="font-size: 14px; color: #333">
              Показать сетку карты
            </span>
          </label>
        </div>
        
        <!-- Логи под картой -->
        <div
          :style="{
            width: `${gameAreaWidth}px`,
            height: '600px',
            minHeight: '600px',
            maxHeight: '900px',
            flexShrink: 0,
          }"
        >
          <GameLogs :logs="gameLogs" />
        </div>
      </div>

      <!-- Панель управления (справа) -->
      <div
        style="
          width: 350px;
          background: #f9f9f9;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        "
      >
        <!-- Инструменты мастера -->
        <div v-if="gameStore.isGM">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px">
            GM Tools
          </h3>

          <div style="display: flex; flex-direction: column; gap: 12px">
            <!-- Share Audio Button -->
            <div style="display: flex; flex-direction: column; gap: 8px">
              <button
                @click="isSharingAudio ? handleStopAudioSharing() : handleStartAudioSharing()"
                :disabled="audioSharingError !== null"
                style="
                  padding: 10px 16px;
                  border-radius: 8px;
                  border: 1px solid #ccc;
                  background: white;
                  cursor: pointer;
                  font-weight: 500;
                  text-align: left;
                "
              >
                {{ isSharingAudio ? "🔊 Stop Sharing Audio" : "🔇 Share Audio" }}
              </button>
              <div v-if="isSharingAudio" style="font-size: 12px; color: #28a745; padding-left: 4px">
                Sharing audio to players...
              </div>
              <div v-if="audioSharingError" style="font-size: 12px; color: #dc3545; padding-left: 4px">
                {{ audioSharingError }}
              </div>
            </div>
            <!-- Кнопка добавления токена -->
            <button
              @click="showAddTokenForm = !showAddTokenForm"
              style="
                padding: 10px 16px;
                border-radius: 8px;
                border: 1px solid #ccc;
                background: white;
                cursor: pointer;
                font-weight: 500;
                text-align: left;
              "
            >
              {{ showAddTokenForm ? "✕ Cancel" : "+ Add Token" }}
            </button>

            <!-- Форма добавления токена -->
            <div
              v-if="showAddTokenForm"
              style="
                padding: 16px;
                border: 1px solid #ddd;
                border-radius: 8px;
                background: white;
              "
            >
              <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 14px">
                Add Token
              </h4>
              <div style="display: flex; flex-direction: column; gap: 12px">
                <label style="display: flex; flex-direction: column; gap: 4px">
                  <span style="font-size: 13px; font-weight: 500"
                    >Token Image *</span
                  >
                  <input
                    type="file"
                    accept="image/*"
                    @change="handleFileSelect"
                    :disabled="isUploading"
                    style="
                      padding: 8px;
                      border: 1px solid #ccc;
                      border-radius: 4px;
                      font-size: 13px;
                    "
                  />
                  <small style="color: #666; font-size: 11px">
                    Max 5MB (JPG, PNG, GIF, WebP, SVG)
                  </small>
                  <small
                    v-if="newTokenFile"
                    style="color: #28a745; font-size: 11px; margin-top: 4px"
                  >
                    Selected: {{ newTokenFile.name }} ({{
                      (newTokenFile.size / 1024).toFixed(1)
                    }}
                    KB)
                  </small>
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px">
                  <span style="font-size: 13px; font-weight: 500"
                    >Owner (optional)</span
                  >
                  <select
                    v-model="newTokenOwnerId"
                    :disabled="isUploading"
                    style="
                      padding: 8px;
                      border: 1px solid #ccc;
                      border-radius: 4px;
                      font-size: 13px;
                    "
                  >
                    <option value="">None (GM owns)</option>
                    <option
                      v-for="member in membersForOwnerSelect"
                      :key="member.id"
                      :value="member.id"
                    >
                      {{ member.name }} ({{ member.role }})
                    </option>
                  </select>
                </label>
                <button
                  @click="handleAddToken"
                  :disabled="!newTokenFile || isUploading"
                  style="
                    padding: 8px 16px;
                    border-radius: 6px;
                    border: none;
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    align-self: flex-start;
                  "
                >
                  {{ isUploading ? "Uploading..." : "Add Token" }}
                </button>
              </div>
            </div>

            <!-- Кнопка установки карты -->
            <button
              @click="showSetMapForm = !showSetMapForm"
              style="
                padding: 10px 16px;
                border-radius: 8px;
                border: 1px solid #ccc;
                background: white;
                cursor: pointer;
                font-weight: 500;
                text-align: left;
              "
            >
              {{ showSetMapForm ? "✕ Cancel" : "+ Set Map" }}
            </button>

            <!-- Форма загрузки карты -->
            <div
              v-if="showSetMapForm"
              style="
                padding: 16px;
                border: 1px solid #ddd;
                border-radius: 8px;
                background: white;
              "
            >
              <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 14px">
                Set Map
              </h4>
              <div style="display: flex; flex-direction: column; gap: 12px">
                <label style="display: flex; flex-direction: column; gap: 4px">
                  <span style="font-size: 13px; font-weight: 500"
                    >Map Image *</span
                  >
                  <input
                    type="file"
                    accept="image/*"
                    @change="handleMapFileSelect"
                    :disabled="isUploadingMap"
                    style="
                      padding: 8px;
                      border: 1px solid #ccc;
                      border-radius: 4px;
                      font-size: 13px;
                    "
                  />
                  <small style="color: #666; font-size: 11px">
                    Max 10MB (JPG, PNG, GIF, WebP, SVG)
                  </small>
                  <small
                    v-if="newMapFile"
                    style="color: #28a745; font-size: 11px; margin-top: 4px"
                  >
                    Selected: {{ newMapFile.name }} ({{
                      (newMapFile.size / 1024).toFixed(1)
                    }}
                    KB)
                  </small>
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px">
                  <span style="font-size: 13px; font-weight: 500"
                    >Grid Rows *</span
                  >
                  <input
                    type="number"
                    v-model.number="gridRows"
                    :disabled="isUploadingMap"
                    min="1"
                    max="100"
                    style="
                      padding: 8px;
                      border: 1px solid #ccc;
                      border-radius: 4px;
                      font-size: 13px;
                    "
                  />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px">
                  <span style="font-size: 13px; font-weight: 500"
                    >Grid Columns *</span
                  >
                  <input
                    type="number"
                    v-model.number="gridColumns"
                    :disabled="isUploadingMap"
                    min="1"
                    max="100"
                    style="
                      padding: 8px;
                      border: 1px solid #ccc;
                      border-radius: 4px;
                      font-size: 13px;
                    "
                  />
                </label>
                <button
                  @click="handleSetMap"
                  :disabled="!newMapFile || isUploadingMap"
                  style="
                    padding: 8px 16px;
                    border-radius: 6px;
                    border: none;
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    align-self: flex-start;
                  "
                >
                  {{ isUploadingMap ? "Uploading..." : "Set Map" }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Roll the Dice -->
        <DiceRoller
          :on-roll="handleDiceRoll"
          :on-custom-roll="handleCustomDiceRoll"
        />

        <!-- Мои персонажи -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin-top: 0; margin-bottom: 0; font-size: 18px">
              My Characters
            </h3>
            <button
              @click="showCreateCharacterModal = true"
              style="
                padding: 6px 12px;
                border-radius: 4px;
                border: none;
                background: #28a745;
                color: white;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
              "
              title="Create new character"
            >
              + New
            </button>
          </div>

          <div v-if="charactersLoading" style="text-align: center; padding: 12px; color: #666; font-size: 13px;">
            Loading...
          </div>

          <div v-else-if="characters.length === 0" style="text-align: center; padding: 16px; color: #666; background: white; border-radius: 6px; border: 1px solid #ddd; font-size: 13px;">
            No characters yet. Create one to add it as a token!
          </div>

          <div v-else style="display: flex; flex-direction: column; gap: 8px;">
            <CharacterCard
              v-for="character in characters"
              :key="character.id"
              :character="character"
              :room-tokens="tokens"
              :current-user-id="me"
              :show-add-token="true"
              :show-remove-token="true"
              size="compact"
              @view="handleViewCharacter"
              @add-token="handleAddCharacterToken"
              @remove-token="handleRemoveCharacterToken"
              @hide-token="handleHideCharacterToken"
              @show-token="handleShowCharacterToken"
            />
          </div>
        </div>

        <!-- NPC (только для GM) -->
        <div v-if="gameStore.isGM">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin-top: 0; margin-bottom: 0; font-size: 18px">
              NPCs
            </h3>
            <button
              @click="handleCreateNPC"
              style="
                padding: 6px 12px;
                border-radius: 4px;
                border: none;
                background: #28a745;
                color: white;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
              "
              title="Create new NPC"
            >
              + New
            </button>
          </div>

          <div v-if="npcsLoading" style="text-align: center; padding: 12px; color: #666; font-size: 13px;">
            Loading...
          </div>

          <div v-else-if="npcs.length === 0" style="text-align: center; padding: 16px; color: #666; background: white; border-radius: 6px; border: 1px solid #ddd; font-size: 13px;">
            No NPCs yet. Create one to add it as a token!
          </div>

          <div v-else style="display: flex; flex-direction: column; gap: 8px;">
            <NPCCard
              v-for="npc in npcs"
              :key="npc.id"
              :npc="npc"
              :show-add-token="true"
              :show-edit-delete="true"
              :current-user-id="user?.uid"
              size="compact"
              @view="handleViewNPC"
              @add-token="handleAddNPCToken"
              @edit="handleEditNPC"
              @delete="handleDeleteNPC"
            />
          </div>
        </div>

        <!-- Список участников -->
        <div>
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px">
            Members
          </h3>
          <ul
            style="
              list-style: none;
              padding: 0;
              margin: 0;
              display: flex;
              flex-direction: column;
              gap: 8px;
            "
          >
            <li
              v-for="m in members"
              :key="m.id"
              style="
                padding: 10px 12px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <span>
                {{ m.name }}
                <span
                  v-if="m.id === me"
                  style="font-weight: bold; color: #007bff"
                  >(you)</span
                >
              </span>
              <span
                style="
                  padding: 2px 8px;
                  background: #e0e0e0;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 500;
                "
              >
                {{ m.role }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Модальное окно просмотра персонажа -->
    <CharacterViewModal
      v-if="selectedCharacter"
      :character="selectedCharacter"
      :room-tokens="tokens"
      :on-custom-roll="handleCustomDiceRoll"
      @close="selectedCharacter = null"
    />

    <!-- Модальное окно создания персонажа -->
    <CreateCharacterModal
      v-if="showCreateCharacterModal"
      :server-url="serverUrl"
      @close="showCreateCharacterModal = false"
      @created="handleCharacterCreated"
    />

    <!-- Модальное окно создания/редактирования NPC -->
    <CreateNPCModal
      v-if="showCreateNPCModal"
      :visible="showCreateNPCModal"
      :server-url="serverUrl"
      :npc="npcToEdit"
      @close="showCreateNPCModal = false; npcToEdit = null"
      @created="handleNPCCreated"
      @updated="handleNPCUpdated"
    />

    <!-- Модальное окно просмотра NPC -->
    <NPCViewModal
      v-if="showNPCViewModal && selectedNPC"
      :visible="showNPCViewModal"
      :npc="selectedNPC"
      @close="showNPCViewModal = false; selectedNPC = null"
    />

    <!-- Контекстное меню токена -->
    <TokenContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @close="handleCloseContextMenu"
      @deal-damage="handleDealDamage"
    />

    <!-- Модальное окно урона -->
    <DamageModal
      v-if="showDamageModal && damageTokenId"
      :visible="showDamageModal"
      :token-name="tokens[damageTokenId]?.name || 'Токен'"
      :current-hit-points="tokens[damageTokenId]?.hitPoints"
      @close="handleCloseDamageModal"
      @save="handleSaveDamage"
    />

    <!-- Модальное окно подтверждения удаления токена -->
    <div
      v-if="showDeleteTokenModal"
      style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      "
      @click.self="cancelDeleteToken"
    >
      <div
        style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
        "
      >
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600">
          Удалить токен с доски?
        </h3>
        <p style="margin: 0 0 24px 0; color: #666; font-size: 14px; line-height: 1.5">
          Вы действительно хотите удалить токен с доски? Это равносильно смерти персонажа.
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end">
          <button
            @click="cancelDeleteToken"
            style="
              padding: 10px 20px;
              border-radius: 6px;
              border: 1px solid #ccc;
              background: white;
              cursor: pointer;
              font-weight: 500;
              font-size: 14px;
            "
          >
            Отмена
          </button>
          <button
            @click="confirmDeleteToken"
            style="
              padding: 10px 20px;
              border-radius: 6px;
              border: none;
              background: #dc3545;
              color: white;
              cursor: pointer;
              font-weight: 500;
              font-size: 14px;
            "
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
