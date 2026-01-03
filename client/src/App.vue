<script setup>
  import { ref } from "vue";
  import { socket } from "./socket";
  
  const serverUrl = "http://localhost:3001";
  
  const myName = ref("Anna"); // можешь убрать/поменять
  const roomCode = ref("");
  const status = ref("disconnected");
  const members = ref([]);
  const me = ref(null);
  const roomState = ref(null);

  function sendAction(type, payload) {
    if (!socket.connected) return;
    socket.emit("room:action", { action: { type, payload } }, (res) => {
      if (!res?.ok) {
        console.error("Action failed:", res?.error);
      }
    });
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
      members.value = res.members;
      roomState.value = res.state;
      status.value = `joined: ${res.code}`;
    });

    socket.off("room:members");
    socket.on("room:members", ({ members: m }) => {
      members.value = m;
    });

    socket.off("room:state");
    socket.on("room:state", ({ state }) => {
      roomState.value = state;
    });
  }
  </script>
  
  <template>
    <div style="max-width: 720px; margin: 40px auto; font-family: system-ui;">
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
      </p>
  
      <div v-if="members.length" style="margin-top: 16px;">
        <h3>Members</h3>
        <ul>
          <li v-for="m in members" :key="m.id">
            {{ m.name }} <span v-if="m.id === me">(you)</span>
          </li>
        </ul>
        <small>Открой вторую вкладку и зайди в тот же код — увидишь синхронизацию списка.</small>
      </div>

      <div v-if="roomState" style="margin-top: 16px;">
        <h3>Room State</h3>
        <pre style="background: #f5f5f5; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px;">{{ JSON.stringify(roomState, null, 2) }}</pre>
        <small>Состояние комнаты синхронизируется между всеми участниками.</small>

        <div style="margin-top: 16px;">
          <h4>Test Actions</h4>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button @click="sendAction('MAP_SET', { src: 'https://example.com/map.jpg' })">
              Set Map
            </button>
            <button @click="sendAction('TOKEN_ADD', { id: 'token-' + Date.now(), x: 100, y: 100, name: 'Test Token' })">
              Add Token
            </button>
            <button 
              v-if="roomState && Object.keys(roomState.tokens).length > 0"
              @click="() => {
                const tokenId = Object.keys(roomState.tokens)[0];
                sendAction('TOKEN_MOVE', { id: tokenId, x: Math.floor(Math.random() * 500), y: Math.floor(Math.random() * 500) });
              }">
              Move First Token
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
    </div>
  </template>
  
  <style scoped>
  input { padding: 8px 10px; border: 1px solid #ccc; border-radius: 8px; }
  button { padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
  