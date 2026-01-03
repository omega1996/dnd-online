<script setup>
import { ref, watch, onMounted } from "vue";
import { useAuth } from "../composables/useAuth";
import { useCharacters } from "../composables/useCharacters";
import CreateCharacterModal from "./CreateCharacterModal.vue";
import CharacterViewModal from "./CharacterViewModal.vue";
import CharacterCard from "./CharacterCard.vue";

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

const { user, logout } = useAuth();
const { characters, fetchCharacters, loading: charactersLoading } = useCharacters();
const myName = ref("");
const roomCode = ref("");
const showCreateModal = ref(false);
const selectedCharacter = ref(null);

// Синхронизируем код комнаты из пропсов
watch(() => props.initialRoomCode, (newCode) => {
  if (newCode) {
    roomCode.value = newCode;
  }
}, { immediate: true });

// Загружаем персонажей при монтировании
onMounted(async () => {
  if (user.value) {
    await fetchCharacters();
  }
});

// Следим за изменением пользователя
watch(() => user.value, async (newUser) => {
  if (newUser) {
    await fetchCharacters();
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

async function handleLogout() {
  try {
    await logout();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

function handleCharacterCreated() {
  fetchCharacters();
}

function handleViewCharacter(character) {
  selectedCharacter.value = character;
}
</script>

<template>
  <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; width: 100vw; overflow-y: auto; font-family: system-ui; padding: 20px;">
    <div style="max-width: 600px; width: 100%; padding: 40px; background: #f9f9f9; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
        <h1 style="margin: 0; text-align: center; flex: 1;">DnD Online</h1>
      </div>

      <!-- Информация о пользователе -->
      <div
        v-if="user"
        style="
          padding: 12px;
          background: #e8f4f8;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #555;
        "
      >
        <div style="font-weight: 500; margin-bottom: 4px;">Signed in as:</div>
        <div style="color: #007bff;">{{ user.email || user.displayName || 'User' }}</div>
        <button
          @click="handleLogout"
          style="
            padding: 8px 16px;
            border-radius: 6px;
            border: 1px solid #ccc;
            background: white;
            color: #666;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            margin-top: 8px;
          "
          title="Sign out"
        >
          Sign Out
        </button>
      </div>

      <!-- Секция персонажей -->
      <div v-if="user" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h2 style="margin: 0; font-size: 18px;">My Characters</h2>
          <button
            @click="showCreateModal = true"
            style="
              padding: 8px 16px;
              border-radius: 6px;
              border: none;
              background: #28a745;
              color: white;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
            "
          >
            + Create Character
          </button>
        </div>

        <div v-if="charactersLoading" style="text-align: center; padding: 20px; color: #666;">
          Loading characters...
        </div>

        <div v-else-if="characters.length === 0" style="text-align: center; padding: 20px; color: #666; background: white; border-radius: 8px; border: 1px solid #ddd;">
          No characters yet. Create your first character!
        </div>

        <div v-else style="display: flex; flex-direction: column; gap: 12px;">
          <CharacterCard
            v-for="character in characters"
            :key="character.id"
            :character="character"
            :room-tokens="{}"
            :current-user-id="null"
            :show-add-token="false"
            :show-remove-token="false"
            size="normal"
            @view="handleViewCharacter"
          />
        </div>
      </div>
      
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

    <!-- Модальное окно создания персонажа -->
    <CreateCharacterModal
      v-if="showCreateModal"
      :server-url="serverUrl"
      @close="showCreateModal = false"
      @created="handleCharacterCreated"
    />

    <!-- Модальное окно просмотра персонажа -->
    <CharacterViewModal
      v-if="selectedCharacter"
      :character="selectedCharacter"
      @close="selectedCharacter = null"
    />
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
