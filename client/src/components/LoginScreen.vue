<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  serverUrl: {
    type: String,
    required: true
  },
  initialRoomCode: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(['join', 'create-room']);

const myName = ref("");
const roomCode = ref("");

// Синхронизируем код комнаты из пропсов
watch(() => props.initialRoomCode, (newCode) => {
  if (newCode) {
    roomCode.value = newCode;
  }
}, { immediate: true });

function handleJoin() {
  if (!roomCode.value.trim() || !myName.value.trim()) {
    return;
  }
  emit('join', { name: myName.value, code: roomCode.value });
}

function handleCreateRoom() {
  emit('create-room');
}
</script>

<template>
  <div style="display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw; overflow: hidden; font-family: system-ui;">
    <div style="max-width: 400px; width: 100%; padding: 40px; background: #f9f9f9; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h1 style="margin-top: 0; margin-bottom: 32px; text-align: center;">DnD Online</h1>
      
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <label style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-weight: 500;">Your name</span>
          <input 
            v-model="myName" 
            placeholder="Enter your name" 
            @keyup.enter="handleJoin"
            style="padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px;"
          />
        </label>

        <label style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-weight: 500;">Room code</span>
          <input 
            v-model="roomCode" 
            placeholder="ABC123" 
            @keyup.enter="handleJoin"
            style="padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; text-transform: uppercase;"
          />
        </label>

        <div style="display: flex; gap: 12px; flex-direction: column;">
          <button 
            @click="handleJoin" 
            :disabled="!roomCode.trim() || !myName.trim()"
            style="padding: 12px; border-radius: 8px; border: none; background: #007bff; color: white; font-size: 16px; cursor: pointer; font-weight: 500;"
          >
            Join Room
          </button>
          <button 
            @click="handleCreateRoom"
            style="padding: 12px; border-radius: 8px; border: 1px solid #ccc; background: white; color: #333; font-size: 16px; cursor: pointer; font-weight: 500;"
          >
            Create Room
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
