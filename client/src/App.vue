<script setup>
  import { ref, computed } from "vue";
  import { socket } from "./socket";
  import { useAuth } from "./composables/useAuth";
  import { useGameStore } from "./stores/gameStore";
  import { buildApiUrl } from "./utils/api.js";
  import AuthScreen from "./components/AuthScreen.vue";
  import LoginScreen from "./components/LoginScreen.vue";
  import GameScreen from "./components/GameScreen.vue";
  
  // In development, use direct backend URL to avoid proxy
  // In production, use empty string so nginx will proxy all requests to server
  // This avoids CORS issues and works better with HTTPS
  const serverUrl = import.meta.env.DEV ? "http://localhost:3001" : "";
  
  // Авторизация
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = computed(() => !!user.value);
  
  // Game store
  const gameStore = useGameStore();
  
  const status = ref("disconnected");
  const pendingCharacterToken = ref(null); // Персонаж, который нужно добавить после входа в комнату

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

  // Обработчик перемещения токена
  function handleTokenMove(tokenId, gridX, gridY) {
    console.log('[App] Token move:', tokenId, 'to grid', gridX, gridY);
    sendAction('TOKEN_MOVE', { id: tokenId, gridX, gridY });
  }

  // Обработчик действий от GameScreen
  function handleAction({ type, payload }) {
    sendAction(type, payload);
  }
  
  async function handleCreateRoom() {
    // Use buildApiUrl helper to avoid double slashes
    const apiUrl = buildApiUrl(serverUrl, "/rooms");
    const r = await fetch(apiUrl, { 
      method: "POST",
      credentials: 'include' // Include credentials for CORS
    });
    const data = await r.json();
    gameStore.roomCode = data.code;
    // После создания комнаты автоматически заполняем код, но не присоединяемся
  }
  
  function handleJoin({ name, code }) {
    gameStore.myName = name;
    gameStore.roomCode = code;
    status.value = "connecting";
    if (!socket.connected) socket.connect();
  
    socket.emit("room:join", { code: code.trim().toUpperCase(), name: name }, (res) => {
      if (!res?.ok) {
        status.value = `error: ${res?.error || "unknown"}`;
        alert(`Failed to join room: ${res?.error || "unknown"}`);
        return;
      }
      console.log('[App] Join response:', res);
      console.log('[App] Role:', res.role);
      
      // Сохраняем информацию о комнате в store
      gameStore.setRoomInfo({
        code: res.code,
        name: name,
        me: res.me,
        role: res.role,
        members: res.members,
        state: res.state || { map: null, tokens: {} }
      });
      
      status.value = `joined: ${res.code} (${res.role})`;
      console.log('[App] Joined room:', res.code);
      console.log('[App] Initial room state:', res.state);
      console.log('[App] Initial tokens:', res.state?.tokens);
      console.log('[App] isInRoom after join:', gameStore.isInRoom);
      console.log('[App] isGM:', gameStore.isGM);
      
      // Если есть персонаж, который нужно добавить, добавляем его
      if (pendingCharacterToken.value) {
        const character = pendingCharacterToken.value;
        pendingCharacterToken.value = null;
        // Небольшая задержка, чтобы GameScreen успел смонтироваться
        setTimeout(() => {
          handleAddCharacterToken(character);
        }, 100);
      }
    });

    socket.off("room:members");
    socket.on("room:members", ({ members: m }) => {
      gameStore.updateMembers(m);
    });

    socket.off("room:state");
    socket.on("room:state", ({ state }) => {
      console.log('[App] Room state updated:', state);
      console.log('[App] Tokens:', state?.tokens);
      console.log('[App] Map:', state?.map);
      gameStore.updateRoomState(state);
    });
  }

  // Выход из комнаты
  function handleLeave() {
    if (socket.connected) {
      socket.disconnect();
    }
    // Очищаем состояние
    gameStore.leaveRoom();
    status.value = "disconnected";
    console.log('[App] Left room');
  }

  // Обработчик добавления токена персонажа
  function handleAddCharacterToken(character) {
    console.log('[App] Adding character token:', character);
    // Если пользователь уже в комнате, передаем персонажа в GameScreen через событие
    if (gameStore.isInRoom) {
      // GameScreen будет слушать это событие
      // Пока просто сохраняем персонажа, GameScreen сам его заберет
      pendingCharacterToken.value = character;
    } else {
      // Если не в комнате, сохраняем персонажа для добавления после входа
      pendingCharacterToken.value = character;
      // Показываем сообщение, что нужно присоединиться к комнате
      if (!gameStore.roomCode?.trim() || !gameStore.myName.trim()) {
        alert("Please enter your name and room code, then join the room to add your character token");
      }
    }
  }
  </script>
  
  <template>
    <div style="font-family: system-ui; height: 100vh; width: 100vw; overflow: hidden;">
      <!-- Показываем загрузку при проверке авторизации -->
      <div 
        v-if="authLoading"
        style="
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 18px;
          color: #666;
        "
      >
        Loading...
      </div>

      <!-- Экран авторизации (если не авторизован) -->
      <AuthScreen v-else-if="!isAuthenticated" />

      <!-- Экран входа (если авторизован, но не в комнате) -->
      <LoginScreen 
        v-else-if="!gameStore.isInRoom"
        :server-url="serverUrl"
        :initial-room-code="gameStore.roomCode"
        @join="handleJoin"
        @create-room="handleCreateRoom"
      />

      <!-- Экран игры (если в комнате) -->
      <GameScreen 
        v-else
        :server-url="serverUrl"
        :room-code="gameStore.roomCode"
        :members="gameStore.members"
        :me="gameStore.me"
        :my-role="gameStore.myRole"
        :room-state="gameStore.roomState"
        :pending-character-token="pendingCharacterToken"
        @leave="handleLeave"
        @token-move="handleTokenMove"
        @action="handleAction"
        @character-token-added="pendingCharacterToken = null"
      />
    </div>
  </template>
  