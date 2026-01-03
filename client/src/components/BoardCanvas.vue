<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as PIXI from 'pixi.js';
import { useBoardState } from '../composables/useBoardState';

const props = defineProps({
  mapSrc: {
    type: String,
    default: null
  },
  tokens: {
    type: Object,
    default: () => ({})
  },
  onTokenMove: {
    type: Function,
    required: true
  }
});

const canvasRef = ref(null);
const app = ref(null);
const worldContainer = ref(null);
const mapSprite = ref(null);
const tokenSprites = ref(new Map());

const boardState = useBoardState();

// Инициализация PixiJS
async function initPixi() {
  if (!canvasRef.value) return;

  try {
    app.value = new PIXI.Application();
    
    await app.value.init({
      width: canvasRef.value.clientWidth,
      height: canvasRef.value.clientHeight,
      backgroundColor: 0x2c3e50,
      antialias: true
    });

    canvasRef.value.appendChild(app.value.canvas);

    // Создаем world контейнер для правильной работы координат
    worldContainer.value = new PIXI.Container();
    app.value.stage.addChild(worldContainer.value);

    // Загружаем карту если есть
    if (props.mapSrc) {
      await loadMap(props.mapSrc);
    }

    // Создаем токены
    updateTokens();

    // Настраиваем взаимодействие
    setupInteraction();
  } catch (error) {
    console.error('[BoardCanvas] Init error:', error);
  }
}

// Загрузка карты
async function loadMap(src) {
  if (!worldContainer.value || !src) return;

  try {
    // Удаляем старую карту
    if (mapSprite.value) {
      worldContainer.value.removeChild(mapSprite.value);
      mapSprite.value.destroy();
      mapSprite.value = null;
    }

    // Загружаем текстуру
    const textureResource = await PIXI.Assets.load(src);
    
    // Обрабатываем разные варианты возвращаемого значения
    let finalTexture;
    if (textureResource instanceof PIXI.Texture) {
      finalTexture = textureResource;
    } else if (textureResource && textureResource.texture) {
      finalTexture = textureResource.texture;
    } else {
      // Fallback: создаем из URL напрямую
      finalTexture = PIXI.Texture.from(src);
    }
    
    if (!finalTexture) {
      throw new Error('Failed to create texture');
    }
    
    mapSprite.value = new PIXI.Sprite(finalTexture);
    worldContainer.value.addChildAt(mapSprite.value, 0);
  } catch (error) {
    console.error('[BoardCanvas] Failed to load map:', error);
  }
}

// Обновление токенов
function updateTokens() {
  if (!worldContainer.value) return;

  const currentTokenIds = new Set(Object.keys(props.tokens));
  const spriteTokenIds = new Set(tokenSprites.value.keys());

  // Удаляем токены которых больше нет
  for (const tokenId of spriteTokenIds) {
    if (!currentTokenIds.has(tokenId)) {
      const sprite = tokenSprites.value.get(tokenId);
      if (sprite) {
        worldContainer.value.removeChild(sprite);
        sprite.destroy();
      }
      tokenSprites.value.delete(tokenId);
    }
  }

  // Добавляем/обновляем токены
  for (const [tokenId, token] of Object.entries(props.tokens)) {
    let sprite = tokenSprites.value.get(tokenId);
    
    if (!sprite) {
      // Создаем простой круг
      const graphics = new PIXI.Graphics();
      graphics.circle(0, 0, 30);
      graphics.fill(0xffd700);
      graphics.stroke({ width: 3, color: 0xff8c00 });
      
      sprite = graphics;
      sprite.x = token.x || 0;
      sprite.y = token.y || 0;
      sprite.tokenId = tokenId;
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      
      tokenSprites.value.set(tokenId, sprite);
      worldContainer.value.addChild(sprite);
      
      // Настраиваем drag для нового токена
      setupTokenDrag(sprite);
    } else {
      // Обновляем позицию только если токен не перетаскивается
      if (boardState.draggedToken.value !== tokenId) {
        sprite.x = token.x || 0;
        sprite.y = token.y || 0;
      }
    }
  }
}

// Настройка drag для токена
function setupTokenDrag(sprite) {
  if (!sprite) return;

  // Удаляем старые обработчики
  sprite.off('pointerdown');
  sprite.off('pointerup');
  sprite.off('pointerupoutside');

  sprite.on('pointerdown', (e) => {
    e.stopPropagation();
    const worldPos = globalToWorld(e.global.x, e.global.y);
    const token = props.tokens[sprite.tokenId];
    if (token) {
      boardState.startDragToken(sprite.tokenId, worldPos.x, worldPos.y, token.x, token.y);
      sprite.alpha = 0.7;
    }
  });

  sprite.on('pointerup', () => {
    if (boardState.draggedToken.value === sprite.tokenId) {
      sprite.alpha = 1;
      const finalPos = boardState.endDragToken();
      if (finalPos) {
        props.onTokenMove(finalPos.tokenId, finalPos.x, finalPos.y);
      }
    }
  });

  sprite.on('pointerupoutside', () => {
    if (boardState.draggedToken.value === sprite.tokenId) {
      sprite.alpha = 1;
      const finalPos = boardState.endDragToken();
      if (finalPos) {
        props.onTokenMove(finalPos.tokenId, finalPos.x, finalPos.y);
      }
    }
  });
}

// Преобразование глобальных координат в мировые
function globalToWorld(globalX, globalY) {
  if (!worldContainer.value) {
    return { x: 0, y: 0 };
  }
  const localPos = worldContainer.value.toLocal({ x: globalX, y: globalY });
  return { x: localPos.x, y: localPos.y };
}

// Настройка взаимодействия
function setupInteraction() {
  if (!app.value) return;

  // Обработка движения мыши для drag токенов
  app.value.stage.eventMode = 'static';
  app.value.stage.hitArea = app.value.screen;

  app.value.stage.on('pointermove', (e) => {
    if (boardState.draggedToken.value) {
      const worldPos = globalToWorld(e.global.x, e.global.y);
      boardState.updateDragPosition(worldPos.x, worldPos.y);
      
      const sprite = tokenSprites.value.get(boardState.draggedToken.value);
      if (sprite) {
        const pos = boardState.getDragPosition();
        sprite.x = pos.x;
        sprite.y = pos.y;
      }
    }
  });
}

// Watchers
watch(() => props.mapSrc, (newSrc) => {
  if (newSrc && worldContainer.value) {
    loadMap(newSrc);
  }
});

watch(() => props.tokens, () => {
  updateTokens();
}, { deep: true });

onMounted(() => {
  initPixi();
});

onUnmounted(() => {
  if (app.value) {
    app.value.destroy(true);
  }
});
</script>

<template>
  <div ref="canvasRef" class="board-canvas"></div>
</template>

<style scoped>
.board-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>