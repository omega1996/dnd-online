<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useGameStore } from '../stores/gameStore';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  }
});

// Используем store для получения информации о роли
const gameStore = useGameStore();

// Отладочный вывод для проверки значения isGM из store
watch(() => props.visible, (newVal) => {
  if (newVal) {
    console.log('[TokenContextMenu] Menu opened, isGM from store:', gameStore.isGM);
    console.log('[TokenContextMenu] myRole:', gameStore.myRole);
  }
});

const emit = defineEmits(['close', 'deal-damage']);

const menuRef = ref(null);

// Закрытие меню при клике вне его
function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    emit('close');
  }
}

// Закрытие меню при нажатии Escape
function handleEscape(event) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

// Обработчик клика по пункту "нанести урон"
function handleDealDamage() {
  emit('deal-damage');
  emit('close');
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <div
    v-if="visible"
    ref="menuRef"
    :style="{
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      minWidth: '180px',
      padding: '4px 0',
      fontFamily: 'system-ui'
    }"
    @click.stop
  >
    <!-- Пункт меню "нанести урон" только для GM -->
    <template v-if="gameStore.isGM">
      <div
        @click="handleDealDamage"
        :style="{
          padding: '10px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#333',
          transition: 'background-color 0.15s'
        }"
        @mouseenter="$event.target.style.backgroundColor = '#f5f5f5'"
        @mouseleave="$event.target.style.backgroundColor = 'transparent'"
      >
        Нанести урон
      </div>
    </template>
    
    <!-- Пустое меню для игроков (для будущего функционала) -->
    <template v-else>
      <div
        :style="{
          padding: '10px 16px',
          fontSize: '14px',
          color: '#999',
          fontStyle: 'italic'
        }"
      >
        Нет доступных действий
      </div>
    </template>
  </div>
</template>

<style scoped>
</style>
