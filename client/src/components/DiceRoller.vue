<script setup>
import { ref } from 'vue';
import CustomDiceModal from './CustomDiceModal.vue';

const props = defineProps({
  onRoll: {
    type: Function,
    required: true,
  },
  onCustomRoll: {
    type: Function,
    required: true,
  },
});

const showCustomModal = ref(false);

const diceTypes = [
  { label: 'D4', value: 4 },
  { label: 'D6', value: 6 },
  { label: 'D8', value: 8 },
  { label: 'D10', value: 10 },
  { label: 'D12', value: 12 },
  { label: 'D20', value: 20 },
];

function rollDice(sides) {
  const result = Math.floor(Math.random() * sides) + 1;
  props.onRoll(sides, result);
}

function openCustomModal() {
  showCustomModal.value = true;
}

function closeCustomModal() {
  showCustomModal.value = false;
}

function handleCustomRoll(rollData) {
  props.onCustomRoll(rollData);
}
</script>

<template>
  <div>
    <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 18px">
      Roll the Dice
    </h3>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      <button
        v-for="dice in diceTypes"
        :key="dice.value"
        @click="rollDice(dice.value)"
        style="
          padding: 10px 16px;
          border-radius: 6px;
          border: 1px solid #ccc;
          background: white;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        "
        @mouseenter="$event.target.style.background = '#f0f0f0'"
        @mouseleave="$event.target.style.background = 'white'"
      >
        {{ dice.label }}
      </button>
      <button
        @click="openCustomModal"
        style="
          padding: 10px 16px;
          border-radius: 6px;
          border: 1px solid #007bff;
          background: #007bff;
          color: white;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        "
        @mouseenter="$event.target.style.background = '#0056b3'"
        @mouseleave="$event.target.style.background = '#007bff'"
      >
        Custom
      </button>
    </div>
    
    <!-- Модальное окно кастомного броска -->
    <CustomDiceModal
      :visible="showCustomModal"
      @close="closeCustomModal"
      @roll="handleCustomRoll"
    />
  </div>
</template>

<style scoped>
button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
