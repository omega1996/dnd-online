<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  tokenName: {
    type: String,
    default: ''
  },
  currentHitPoints: {
    type: Number,
    default: null
  }
});

const emit = defineEmits(['close', 'save']);

const damageAmount = ref('');
const inputRef = ref(null);

// Фокус на поле ввода при открытии модального окна
watch(() => props.visible, (newVal) => {
  if (newVal) {
    damageAmount.value = '';
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus();
      }
    });
  }
});

// Обработчик сохранения
function handleSave() {
  const amount = parseInt(damageAmount.value);
  if (isNaN(amount) || amount <= 0) {
    alert('Пожалуйста, введите положительное число');
    return;
  }
  emit('save', amount);
}

// Обработчик отмены
function handleCancel() {
  emit('close');
}

// Закрытие по Escape
function handleKeydown(event) {
  if (event.key === 'Escape') {
    handleCancel();
  } else if (event.key === 'Enter') {
    handleSave();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    v-if="visible"
    :style="{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      fontFamily: 'system-ui'
    }"
    @click.self="handleCancel"
  >
    <div
      :style="{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
      }"
    >
      <h3
        :style="{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: 600,
          color: '#333'
        }"
      >
        Нанести урон
      </h3>
      
      <div
        :style="{
          marginBottom: '20px'
        }"
      >
        <p
          :style="{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: '#666'
          }"
        >
          Токен: <strong>{{ tokenName }}</strong>
        </p>
        <p
          v-if="currentHitPoints !== null"
          :style="{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: '#666'
          }"
        >
          Текущие HP: <strong>{{ currentHitPoints }}</strong>
        </p>
      </div>
      
      <label
        :style="{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '24px'
        }"
      >
        <span
          :style="{
            fontSize: '14px',
            fontWeight: 500,
            color: '#333'
          }"
        >
          Количество урона *
        </span>
        <input
          ref="inputRef"
          type="number"
          v-model="damageAmount"
          min="1"
          step="1"
          placeholder="Введите число"
          :style="{
            padding: '10px 12px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none'
          }"
          @keydown.enter.prevent="handleSave"
        />
      </label>
      
      <div
        :style="{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }"
      >
        <button
          @click="handleCancel"
          :style="{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            background: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            color: '#333'
          }"
        >
          Отмена
        </button>
        <button
          @click="handleSave"
          :style="{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            background: '#dc3545',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px'
          }"
        >
          Нанести урон
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
input:focus {
  border-color: #007bff !important;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

button:hover {
  opacity: 0.9;
}
</style>
