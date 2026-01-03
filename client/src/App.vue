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

  // Computed для карты и токенов
  const mapSrc = computed(() => roomState.value?.map?.src || null);
  const tokens = computed(() => roomState.value?.tokens || {});

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

        <div v-if="roomState" style="margin-top: 16px;">
          <h4>Test Actions</h4>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button @click="sendAction('MAP_SET', { src: 'https://picsum.photos/800/600' })">
              Set Map
            </button>
            <button @click="sendAction('TOKEN_ADD', { id: 'token-' + Date.now(), x: 100, y: 100, name: 'Test Token' })">
              Add Token
            </button>
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
  