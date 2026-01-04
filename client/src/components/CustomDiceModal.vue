<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close', 'roll']);

// Максимальное количество кубиков
const MAX_DICE = 5;

// Список кубиков: каждый кубик имеет максимальное значение (sides)
const diceList = ref([{ sides: 6 }]);

// Статическое число для добавления к сумме
const staticModifier = ref(0);

// Добавить кубик
function addDice() {
  if (diceList.value.length < MAX_DICE) {
    diceList.value.push({ sides: 6 });
  }
}

// Удалить кубик
function removeDice(index) {
  if (diceList.value.length > 1) {
    diceList.value.splice(index, 1);
  }
}

// Вычислить строку описания броска (например, "D6+D20+4")
const diceDescription = computed(() => {
  const diceParts = diceList.value.map(d => `D${d.sides}`).join('+');
  const modifier = staticModifier.value !== 0 ? (staticModifier.value > 0 ? `+${staticModifier.value}` : `${staticModifier.value}`) : '';
  return diceParts + modifier;
});

// Бросить кубики
function rollDice() {
  // Бросаем каждый кубик отдельно
  const results = diceList.value.map(dice => {
    return Math.floor(Math.random() * dice.sides) + 1;
  });
  
  // Суммируем результаты
  const sum = results.reduce((acc, val) => acc + val, 0) + staticModifier.value;
  
  // Отправляем событие с данными о броске
  emit('roll', {
    dice: diceList.value.map(d => d.sides),
    results: results,
    modifier: staticModifier.value,
    sum: sum,
    description: diceDescription.value,
  });
  
  // Закрываем модальное окно
  emit('close');
}

// Закрыть модальное окно
function closeModal() {
  emit('close');
}

// Сбросить форму
function resetForm() {
  diceList.value = [{ sides: 6 }];
  staticModifier.value = 0;
}
</script>

<template>
  <div
    v-if="visible"
    style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    "
    @click.self="closeModal"
  >
    <div
      style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      "
    >
      <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600">
        Кастомный бросок кубика
      </h3>

      <!-- Список кубиков -->
      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
        <div
          v-for="(dice, index) in diceList"
          :key="index"
          style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #f9f9f9;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
          "
        >
          <span style="font-weight: 500; min-width: 60px;">Кубик {{ index + 1 }}:</span>
          <label style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <span style="font-size: 14px;">D</span>
            <input
              type="number"
              v-model.number="dice.sides"
              min="2"
              max="100"
              style="
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
                width: 80px;
              "
            />
          </label>
          <button
            v-if="diceList.length > 1"
            @click="removeDice(index)"
            style="
              padding: 6px 12px;
              border-radius: 4px;
              border: 1px solid #dc3545;
              background: white;
              color: #dc3545;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            "
          >
            Удалить
          </button>
        </div>
      </div>

      <!-- Кнопка добавления кубика -->
      <button
        v-if="diceList.length < MAX_DICE"
        @click="addDice"
        style="
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid #28a745;
          background: white;
          color: #28a745;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
          width: 100%;
        "
      >
        + Добавить кубик ({{ diceList.length }}/{{ MAX_DICE }})
      </button>

      <!-- Статическое число -->
      <div style="margin-bottom: 20px;">
        <label style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-size: 14px; font-weight: 500;">Статическое число (модификатор)</span>
          <input
            type="number"
            v-model.number="staticModifier"
            min="-100"
            max="100"
            style="
              padding: 8px;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 14px;
            "
          />
        </label>
      </div>

      <!-- Предпросмотр описания -->
      <div
        style="
          padding: 12px;
          background: #e7f3ff;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid #b3d9ff;
        "
      >
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Формат броска:</div>
        <div style="font-size: 16px; font-weight: 600; color: #0066cc;">
          {{ diceDescription }}
        </div>
      </div>

      <!-- Кнопки -->
      <div style="display: flex; gap: 12px; justify-content: flex-end">
        <button
          @click="closeModal"
          style="
            padding: 10px 20px;
            border-radius: 6px;
            border: 1px solid #ccc;
            background: white;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
          "
        >
          Отмена
        </button>
        <button
          @click="rollDice"
          style="
            padding: 10px 20px;
            border-radius: 6px;
            border: none;
            background: #007bff;
            color: white;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
          "
        >
          Кинуть кубик
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
}

button:hover {
  opacity: 0.9;
}
</style>
