import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useGameStore = defineStore('game', () => {
  // Информация о текущей комнате
  const roomCode = ref(null);
  const myName = ref('');
  const me = ref(null); // socket.id текущего пользователя
  const myRole = ref(null); // 'GM' или 'Player'
  const members = ref([]);
  const roomState = ref(null);
  
  // Computed для проверки роли
  const isGM = computed(() => {
    return myRole.value?.toUpperCase() === 'GM';
  });
  
  const isInRoom = computed(() => {
    return roomState.value !== null && me.value !== null;
  });
  
  // Методы для обновления состояния
  function setRoomInfo(info) {
    roomCode.value = info.code;
    myName.value = info.name || '';
    me.value = info.me || null;
    myRole.value = info.role || null;
    members.value = info.members || [];
    roomState.value = info.state || null;
    
    // Отладочный вывод
    console.log('[GameStore] setRoomInfo called:', {
      code: info.code,
      role: info.role,
      isGM: isGM.value
    });
  }
  
  function updateMembers(membersList) {
    members.value = membersList;
  }
  
  function updateRoomState(state) {
    roomState.value = state;
  }
  
  function setMyRole(role) {
    myRole.value = role;
  }
  
  function leaveRoom() {
    roomCode.value = null;
    myName.value = '';
    me.value = null;
    myRole.value = null;
    members.value = [];
    roomState.value = null;
  }
  
  return {
    // State
    roomCode,
    myName,
    me,
    myRole,
    members,
    roomState,
    // Computed
    isGM,
    isInRoom,
    // Actions
    setRoomInfo,
    updateMembers,
    updateRoomState,
    setMyRole,
    leaveRoom
  };
});
