<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import BoardCanvas from "./BoardCanvas.vue";

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
});

const emit = defineEmits(["leave", "token-move", "action"]);

// Форма добавления токена (для мастера)
const showAddTokenForm = ref(false);
const newTokenFile = ref(null);
const newTokenOwnerId = ref("");
const isUploading = ref(false);

// Форма загрузки карты (для мастера)
const showSetMapForm = ref(false);
const newMapFile = ref(null);
const isUploadingMap = ref(false);

// Computed для карты и токенов
const mapSrc = computed(() => props.roomState?.map?.src || null);
const tokens = computed(() => props.roomState?.tokens || {});
const isGM = computed(() => props.myRole === "GM");

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

  const response = await fetch(`${props.serverUrl}/upload-token-image`, {
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

  const response = await fetch(`${props.serverUrl}/upload-map-image`, {
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
    const fullImageUrl = `${props.serverUrl}${imageUrl}`;

    const tokenId = generateTokenId();
    // Позиция по центру экрана (можно изменить на случайную или клик мыши)
    const x = 400;
    const y = 300;

    const payload = {
      id: tokenId,
      x,
      y,
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
    const fullImageUrl = `${props.serverUrl}${imageUrl}`;

    // Отправляем действие установки карты
    sendAction("MAP_SET", { src: fullImageUrl });

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

// Обработчик перемещения токена
function handleTokenMove(tokenId, x, y) {
  emit("token-move", tokenId, x, y);
}

function handleLeave() {
  emit("leave");
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
    </div>

    <!-- Основной контент: карта слева, панель справа -->
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
      <!-- Карта (слева) -->
      <div
        :style="{
          width: `${gameAreaWidth}px`,
          height: `${gameAreaHeight}px`,
          minWidth: 0,
          minHeight: 0,
          borderRight: '1px solid #ddd',
          position: 'relative',
          display: 'flex',
          flexShrink: 0,
        }"
      >
        <BoardCanvas
          :map-src="mapSrc"
          :tokens="tokens"
          :on-token-move="handleTokenMove"
        />
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
        <div v-if="isGM">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px">
            GM Tools
          </h3>

          <div style="display: flex; flex-direction: column; gap: 12px">
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
