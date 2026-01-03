import { ref, computed } from 'vue';

/**
 * Composable для управления состоянием доски (камера, токены, карта)
 */
export function useBoardState() {
  // Камера
  const cameraX = ref(0);
  const cameraY = ref(0);
  const cameraZoom = ref(1);

  // Состояние drag
  const draggedToken = ref(null);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const dragOffsetX = ref(0);
  const dragOffsetY = ref(0);

  // Установка позиции камеры
  function setCameraPosition(x, y) {
    cameraX.value = x;
    cameraY.value = y;
  }

  // Установка зума камеры
  function setCameraZoom(zoom) {
    cameraZoom.value = Math.max(0.1, Math.min(5, zoom)); // Ограничиваем зум от 0.1 до 5
  }

  // Начало drag токена
  function startDragToken(tokenId, worldX, worldY, tokenX, tokenY) {
    draggedToken.value = tokenId;
    dragStartX.value = worldX;
    dragStartY.value = worldY;
    dragOffsetX.value = worldX - tokenX;
    dragOffsetY.value = worldY - tokenY;
  }

  // Обновление позиции при drag
  function updateDragPosition(worldX, worldY) {
    if (draggedToken.value) {
      dragStartX.value = worldX;
      dragStartY.value = worldY;
    }
  }

  // Получение финальной позиции токена после drag
  function getDragPosition() {
    if (!draggedToken.value) return null;
    return {
      tokenId: draggedToken.value,
      x: dragStartX.value - dragOffsetX.value,
      y: dragStartY.value - dragOffsetY.value
    };
  }

  // Окончание drag
  function endDragToken() {
    const result = getDragPosition();
    draggedToken.value = null;
    dragOffsetX.value = 0;
    dragOffsetY.value = 0;
    return result;
  }

  return {
    // Камера
    cameraX,
    cameraY,
    cameraZoom,
    setCameraPosition,
    setCameraZoom,
    
    // Drag
    draggedToken,
    startDragToken,
    updateDragPosition,
    endDragToken,
    getDragPosition
  };
}
