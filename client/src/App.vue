<script setup>
  import { ref, computed } from "vue";
  import { socket } from "./socket";
  import LoginScreen from "./components/LoginScreen.vue";
  import GameScreen from "./components/GameScreen.vue";
  
  const serverUrl = "http://localhost:3001";
  
  const myName = ref("");
  const roomCode = ref("");
  const status = ref("disconnected");
  const members = ref([]);
  const me = ref(null);
  const myRole = ref(null);
  const roomState = ref(null);

  // Computed для определения, вошел ли пользователь в комнату
  const isInRoom = computed(() => {
    return roomState.value !== null && me.value !== null;
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

  // Обработчик перемещения токена
  function handleTokenMove(tokenId, x, y) {
    console.log('[App] Token move:', tokenId, 'to', x, y);
    sendAction('TOKEN_MOVE', { id: tokenId, x, y });
  }

  // Обработчик действий от GameScreen
  function handleAction({ type, payload }) {
    sendAction(type, payload);
  }
  
  async function handleCreateRoom() {
    const r = await fetch(`${serverUrl}/rooms`, { method: "POST" });
    const data = await r.json();
    roomCode.value = data.code;
    // После создания комнаты автоматически заполняем код, но не присоединяемся
  }
  
  function handleJoin({ name, code }) {
    myName.value = name;
    roomCode.value = code;
    status.value = "connecting";
    if (!socket.connected) socket.connect();
  
    socket.emit("room:join", { code: code.trim().toUpperCase(), name: name }, (res) => {
      if (!res?.ok) {
        status.value = `error: ${res?.error || "unknown"}`;
        alert(`Failed to join room: ${res?.error || "unknown"}`);
        return;
      }
      console.log('[App] Join response:', res);
      me.value = res.me;
      myRole.value = res.role;
      members.value = res.members;
      roomState.value = res.state || { map: null, tokens: {} };
      status.value = `joined: ${res.code} (${res.role})`;
      console.log('[App] Joined room:', res.code);
      console.log('[App] Initial room state:', res.state);
      console.log('[App] Initial tokens:', res.state?.tokens);
      console.log('[App] isInRoom after join:', roomState.value !== null && me.value !== null);
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

  // Выход из комнаты
  function handleLeave() {
    if (socket.connected) {
      socket.disconnect();
    }
    // Очищаем состояние
    me.value = null;
    myRole.value = null;
    members.value = [];
    roomState.value = null;
    status.value = "disconnected";
    roomCode.value = "";
    console.log('[App] Left room');
  }
  </script>
  
  <template>
    <div style="font-family: system-ui; height: 100vh; width: 100vw; overflow: hidden;">
      <!-- Экран входа -->
      <LoginScreen 
        v-if="!isInRoom"
        :server-url="serverUrl"
        :initial-room-code="roomCode"
        @join="handleJoin"
        @create-room="handleCreateRoom"
      />

      <!-- Экран игры -->
      <GameScreen 
        v-else
        :server-url="serverUrl"
        :room-code="roomCode"
        :members="members"
        :me="me"
        :my-role="myRole"
        :room-state="roomState"
        @leave="handleLeave"
        @token-move="handleTokenMove"
        @action="handleAction"
      />
    </div>
  </template>
  