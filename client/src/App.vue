<script setup>
  import { ref, computed } from "vue";
  import { socket } from "./socket";
  import BoardCanvas from "./components/BoardCanvas.vue";
  
  const serverUrl = "http://localhost:3001";
  
  const myName = ref("Anna"); // можешь убрать/поменять
  const roomCode = ref("");
  const status = ref("disconnected");
  const members = ref([]);
  const me = ref(null);
  const myRole = ref(null);
  const roomState = ref(null);

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
  const mapSrc = computed(() => roomState.value?.map?.src || null);
  const tokens = computed(() => roomState.value?.tokens || {});
  const isGM = computed(() => myRole.value === "GM");

  // Computed для списка участников для выбора владельца
  const membersForOwnerSelect = computed(() => {
    return members.value.map(m => ({ id: m.id, name: m.name, role: m.role }));
  });

  function sendAction(type, payload) {
    if (!socket.connected) return;
    socket.emit("room:action", { action: { type, payload } }, (res) => {
      if (!res?.ok) {
        const errorMsg = res?.error === "PERMISSION_DENIED" 
          ? "Permission denied: You don't have rights to perform this action"
          : res?.error || "unknown";
        console.error("Action failed:", errorMsg);
        alert(`Action failed: ${errorMsg}`);
      }
    });
  }

  // Генерация уникального ID для токена
  function generateTokenId() {
    return `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Загрузка файла на сервер
  async function uploadTokenImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${serverUrl}/upload-token-image`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload image');
    }

    const data = await response.json();
    return data.url; // Возвращаем URL вида /uploads/filename.png
  }

  // Загрузка карты на сервер
  async function uploadMapImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${serverUrl}/upload-map-image`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload image');
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
      const fullImageUrl = `${serverUrl}${imageUrl}`;

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
        ownerId: newTokenOwnerId.value || undefined // Если не выбран, будет установлен socket.id мастера
      };

      sendAction('TOKEN_ADD', payload);
      
      // Очищаем форму
      newTokenFile.value = null;
      newTokenOwnerId.value = "";
      showAddTokenForm.value = false;
    } catch (error) {
      console.error('[App] Failed to upload token image:', error);
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
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        event.target.value = '';
        return;
      }
      // Проверяем размер (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        event.target.value = '';
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
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        event.target.value = '';
        return;
      }
      // Проверяем размер (10MB для карт)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        event.target.value = '';
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
      const fullImageUrl = `${serverUrl}${imageUrl}`;

      // Отправляем действие установки карты
      sendAction('MAP_SET', { src: fullImageUrl });
      
      // Очищаем форму
      newMapFile.value = null;
      showSetMapForm.value = false;
    } catch (error) {
      console.error('[App] Failed to upload map image:', error);
      alert(`Failed to upload image: ${error.message}`);
    } finally {
      isUploadingMap.value = false;
    }
  }

  // Обработчик перемещения токена
  function handleTokenMove(tokenId, x, y) {
    console.log('[App] Token move:', tokenId, 'to', x, y);
    sendAction('TOKEN_MOVE', { id: tokenId, x, y });
  }
  
  async function createRoom() {
    const r = await fetch(`${serverUrl}/rooms`, { method: "POST" });
    const data = await r.json();
    roomCode.value = data.code;
  }
  
  function joinRoom() {
    status.value = "connecting";
    if (!socket.connected) socket.connect();
  
    socket.emit("room:join", { code: roomCode.value.trim().toUpperCase(), name: myName.value }, (res) => {
      if (!res?.ok) {
        status.value = `error: ${res?.error || "unknown"}`;
        return;
      }
      me.value = res.me;
      myRole.value = res.role;
      members.value = res.members;
      roomState.value = res.state;
      status.value = `joined: ${res.code} (${res.role})`;
      console.log('[App] Joined room:', res.code);
      console.log('[App] Initial room state:', res.state);
      console.log('[App] Initial tokens:', res.state?.tokens);
    });

    socket.off("room:members");
    socket.on("room:members", ({ members: m }) => {
      members.value = m;
    });

    socket.off("room:state");
    socket.on("room:state", ({ state }) => {
      console.log('[App] Room state updated:', state);
      console.log('[App] Tokens:', state?.tokens);
      console.log('[App] Map:', state?.map);
      roomState.value = state;
    });
  }
  </script>
  
  <template>
    <div style="font-family: system-ui;">
      <!-- Панель управления -->
      <div style="max-width: 720px; margin: 0 auto; padding: 20px;">
        <h1>DnD Online — Rooms MVP</h1>
  
        <div style="display:flex; gap:12px; align-items:end; flex-wrap: wrap;">
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span>Your name</span>
            <input v-model="myName" placeholder="Name" />
          </label>
  
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span>Room code</span>
            <input v-model="roomCode" placeholder="ABC123" />
          </label>
  
          <button @click="joinRoom" :disabled="!roomCode.trim()">Join</button>
          <button @click="createRoom">Create room</button>
        </div>
  
        <p style="margin-top: 16px;">
          <b>Status:</b> {{ status }}
          <span v-if="myRole" style="margin-left: 8px; padding: 2px 8px; background: #e0e0e0; border-radius: 4px; font-size: 12px;">
            {{ myRole }}
          </span>
        </p>

        <div v-if="members.length" style="margin-top: 16px;">
          <h3>Members</h3>
          <ul>
            <li v-for="m in members" :key="m.id">
              {{ m.name }}
              <span v-if="m.id === me" style="font-weight: bold;">(you)</span>
              <span style="margin-left: 8px; padding: 2px 6px; background: #f0f0f0; border-radius: 4px; font-size: 11px;">
                {{ m.role }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Инструменты мастера: Добавление токена -->
        <div v-if="roomState && isGM" style="margin-top: 16px;">
          <h4>GM Tools</h4>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start;">
            <button @click="showAddTokenForm = !showAddTokenForm">
              {{ showAddTokenForm ? 'Cancel' : 'Add Token' }}
            </button>
            <button @click="showSetMapForm = !showSetMapForm">
              {{ showSetMapForm ? 'Cancel' : 'Set Map' }}
            </button>
          </div>

          <!-- Форма добавления токена -->
          <div v-if="showAddTokenForm" style="margin-top: 12px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; max-width: 500px;">
            <h5 style="margin-top: 0;">Add Token</h5>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <label style="display: flex; flex-direction: column; gap: 4px;">
                <span>Token Image *</span>
                <input 
                  type="file"
                  accept="image/*"
                  @change="handleFileSelect"
                  :disabled="isUploading"
                  style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
                />
                <small style="color: #666; font-size: 11px;">
                  Select an image file from your computer (max 5MB, formats: JPG, PNG, GIF, WebP, SVG)
                </small>
                <small v-if="newTokenFile" style="color: #28a745; font-size: 11px; margin-top: 4px;">
                  Selected: {{ newTokenFile.name }} ({{ (newTokenFile.size / 1024).toFixed(1) }} KB)
                </small>
              </label>
              <label style="display: flex; flex-direction: column; gap: 4px;">
                <span>Owner (optional)</span>
                <select 
                  v-model="newTokenOwnerId"
                  :disabled="isUploading"
                  style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
                >
                  <option value="">None (GM owns)</option>
                  <option v-for="member in membersForOwnerSelect" :key="member.id" :value="member.id">
                    {{ member.name }} ({{ member.role }})
                  </option>
                </select>
              </label>
              <button 
                @click="handleAddToken" 
                :disabled="!newTokenFile || isUploading"
                style="align-self: flex-start;"
              >
                {{ isUploading ? 'Uploading...' : 'Add Token' }}
              </button>
            </div>
          </div>

          <!-- Форма загрузки карты -->
          <div v-if="showSetMapForm" style="margin-top: 12px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; max-width: 500px;">
            <h5 style="margin-top: 0;">Set Map</h5>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <label style="display: flex; flex-direction: column; gap: 4px;">
                <span>Map Image *</span>
                <input 
                  type="file"
                  accept="image/*"
                  @change="handleMapFileSelect"
                  :disabled="isUploadingMap"
                  style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
                />
                <small style="color: #666; font-size: 11px;">
                  Select an image file from your computer (max 10MB, formats: JPG, PNG, GIF, WebP, SVG)
                </small>
                <small v-if="newMapFile" style="color: #28a745; font-size: 11px; margin-top: 4px;">
                  Selected: {{ newMapFile.name }} ({{ (newMapFile.size / 1024).toFixed(1) }} KB)
                </small>
              </label>
              <button 
                @click="handleSetMap" 
                :disabled="!newMapFile || isUploadingMap"
                style="align-self: flex-start;"
              >
                {{ isUploadingMap ? 'Uploading...' : 'Set Map' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Тестовые действия (можно оставить для отладки) -->
        <div v-if="roomState" style="margin-top: 16px;">
          <h4>Test Actions</h4>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button 
              v-if="roomState && Object.keys(roomState.tokens).length > 0"
              @click="() => {
                const tokenId = Object.keys(roomState.tokens)[0];
                sendAction('TOKEN_UPDATE', { id: tokenId, name: 'Updated ' + Date.now() });
              }">
              Update First Token
            </button>
            <button 
              v-if="roomState && Object.keys(roomState.tokens).length > 0"
              @click="() => {
                const tokenId = Object.keys(roomState.tokens)[0];
                sendAction('TOKEN_REMOVE', { id: tokenId });
              }">
              Remove First Token
            </button>
          </div>
        </div>
      </div>

      <!-- Canvas доски -->
      <div v-if="roomState" style="width: 100%; height: calc(100vh - 300px); min-height: 500px; border-top: 2px solid #ccc; margin-top: 20px;">
        <BoardCanvas 
          :map-src="mapSrc"
          :tokens="tokens"
          :on-token-move="handleTokenMove"
        />
      </div>
    </div>
  </template>
  
  <style scoped>
  input { padding: 8px 10px; border: 1px solid #ccc; border-radius: 8px; }
  button { padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
  