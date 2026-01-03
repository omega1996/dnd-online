import { ref, computed } from 'vue';

/**
 * Composable для управления логами игры
 */
export function useGameLogs(logsRef) {
  // Фильтры по типам (ключ - тип лога, значение - включен ли фильтр)
  const filters = ref({
    move: true,
    dice: true,
    map_change: true,
    token_add: true,
    token_remove: true,
  });

  // Переключение фильтра по типу
  function toggleFilter(type) {
    if (filters.value.hasOwnProperty(type)) {
      filters.value[type] = !filters.value[type];
    }
  }

  // Отфильтрованные логи (с учетом фильтров)
  const filteredLogs = computed(() => {
    const logs = logsRef?.value || [];
    return logs.filter(log => {
      return filters.value[log?.type] !== false;
    });
  });

  // Получение названия типа лога
  function getLogTypeLabel(type) {
    const labels = {
      move: 'Перемещение',
      dice: 'Бросок кубика',
      map_change: 'Смена карты',
      token_add: 'Добавление токена',
      token_remove: 'Удаление токена',
    };
    return labels[type] || type;
  }

  // Форматирование времени лога
  function formatLogTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return {
    filters,
    filteredLogs,
    toggleFilter,
    getLogTypeLabel,
    formatLogTime,
  };
}
