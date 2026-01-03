<script setup>
import { ref, watch } from 'vue';
import { useGameLogs } from '../composables/useGameLogs';

const props = defineProps({
  logs: {
    type: Array,
    default: () => [],
  },
});

// Создаем реактивную ссылку на логи
const logsRef = ref(props.logs || []);

// Обновляем логи при изменении пропсов
watch(() => props.logs, (newLogs) => {
  logsRef.value = newLogs || [];
}, { immediate: true });

const {
  filters,
  filteredLogs,
  toggleFilter,
  getLogTypeLabel,
  formatLogTime,
} = useGameLogs(logsRef);

// Типы логов для фильтра
const logTypes = [
  { key: 'move', label: 'Перемещения' },
  { key: 'dice', label: 'Броски кубика' },
  { key: 'map_change', label: 'Смена карты' },
  { key: 'token_add', label: 'Добавление токенов' },
  { key: 'token_remove', label: 'Удаление токенов' },
];

// Форматирование сообщения лога
function formatLogMessage(log) {
  switch (log.type) {
    case 'move':
      return `${log.data.tokenName || 'Токен'} переместился с (${log.data.from.x}, ${log.data.from.y}) на (${log.data.to.x}, ${log.data.to.y})`;
    case 'dice':
      const diceType = log.data.diceType || `D${log.data.sides || '?'}`;
      const result = log.data.result || 'N/A';
      if (log.data.criticalType === 'failure') {
        return `${log.userName} бросил ${diceType}: ${result} - КРИТИЧЕСКАЯ НЕУДАЧА`;
      } else if (log.data.criticalType === 'success') {
        return `${log.userName} бросил ${diceType}: ${result} - КРИТИЧЕСКАЯ УДАЧА`;
      }
      return `${log.userName} бросил ${diceType}: ${result}`;
    case 'map_change':
      return `${log.userName} сменил карту`;
    case 'token_add':
      return `${log.data.tokenName || 'Токен'} добавлен на позицию (${log.data.position.x}, ${log.data.position.y})`;
    case 'token_remove':
      return `${log.data.tokenName || 'Токен'} убран с позиции (${log.data.position.x}, ${log.data.position.y})`;
    default:
      return 'Неизвестное действие';
  }
}
</script>

<template>
  <div
    style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      border-top: 1px solid #ddd;
    "
  >
    <!-- Фильтры -->
    <div
      style="
        padding: 12px 16px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      "
    >
      <span style="font-size: 13px; font-weight: 500; color: #666; margin-right: 4px;">
        Фильтры:
      </span>
      <label
        v-for="logType in logTypes"
        :key="logType.key"
        style="
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 12px;
          user-select: none;
        "
      >
        <input
          type="checkbox"
          :checked="filters[logType.key]"
          @change="toggleFilter(logType.key)"
          style="cursor: pointer;"
        />
        <span>{{ logType.label }}</span>
      </label>
    </div>

    <!-- Список логов -->
    <div
      style="
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      "
    >
      <div
        v-if="filteredLogs.length === 0"
        style="
          text-align: center;
          padding: 24px;
          color: #999;
          font-size: 13px;
        "
      >
        Нет логов для отображения
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        style="
          padding: 10px 12px;
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        "
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span
                style="
                  padding: 2px 6px;
                  background: #e0e0e0;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 500;
                  color: #555;
                "
              >
                {{ getLogTypeLabel(log.type) }}
              </span>
              <span style="color: #666; font-size: 11px;">
                {{ log.userName }}
              </span>
            </div>
            <div style="color: #333; line-height: 1.4;">
              {{ formatLogMessage(log) }}
            </div>
          </div>
          <span style="color: #999; font-size: 11px; white-space: nowrap; margin-left: 8px;">
            {{ formatLogTime(log.timestamp) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Стили для скроллбара */
div[style*="overflow-y: auto"]::-webkit-scrollbar {
  width: 8px;
}

div[style*="overflow-y: auto"]::-webkit-scrollbar-track {
  background: #f1f1f1;
}

div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
