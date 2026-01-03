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
  if (!worldContainer.value || !src || !app.value) return;

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
    
    // Растягиваем карту на весь размер canvas
    const canvasWidth = app.value.screen.width;
    const canvasHeight = app.value.screen.height;
    mapSprite.value.width = canvasWidth;
    mapSprite.value.height = canvasHeight;
    mapSprite.value.x = 0;
    mapSprite.value.y = 0;
    
    worldContainer.value.addChildAt(mapSprite.value, 0);
  } catch (error) {
    console.error('[BoardCanvas] Failed to load map:', error);
  }
}

  // Загрузка изображения токена
async function loadTokenImage(tokenId, token) {
  if (!token.src || !token.src.trim()) {
    console.log(`[BoardCanvas] No src for token ${tokenId}, using default`);
    // Если нет src, создаем простой круг
    return createDefaultTokenSprite();
  }

  const src = token.src.trim();
  console.log(`[BoardCanvas] Loading token image for ${tokenId} from ${src}`);

  try {
    // Используем тот же подход, что и для карты - через Assets.load
    // Assets.load уже загружает изображение полностью, поэтому текстура должна быть готова
    const textureResource = await PIXI.Assets.load(src);
    
    // Обрабатываем разные варианты возвращаемого значения
    let finalTexture;
    if (textureResource instanceof PIXI.Texture) {
      finalTexture = textureResource;
      console.log(`[BoardCanvas] Direct Texture instance for ${tokenId}`);
    } else if (textureResource && textureResource.texture) {
      finalTexture = textureResource.texture;
      console.log(`[BoardCanvas] Texture from .texture property for ${tokenId}`);
    } else {
      // Fallback: создаем из URL напрямую
      console.log(`[BoardCanvas] Using fallback Texture.from() for ${tokenId}`);
      finalTexture = PIXI.Texture.from(src);
    }
    
    if (!finalTexture) {
      throw new Error('Failed to create texture object');
    }
    
    // Assets.load уже загрузил изображение, поэтому текстура должна быть готова
    // Проверяем только базовые свойства
    if (finalTexture.width === 0 && finalTexture.height === 0) {
      console.warn(`[BoardCanvas] Texture has zero dimensions for ${tokenId}, but continuing...`);
    }
    
    console.log(`[BoardCanvas] Texture ready for ${tokenId}, size: ${finalTexture.width}x${finalTexture.height}`);
    
    const sprite = new PIXI.Sprite(finalTexture);
    
    // Проверяем, что спрайт создан корректно
    if (sprite.width === 0 || sprite.height === 0) {
      throw new Error('Sprite has zero dimensions');
    }
    
    // Масштабируем токен до разумного размера (например, 60x60)
    const maxSize = 60;
    const scale = Math.min(maxSize / sprite.width, maxSize / sprite.height, 1);
    sprite.scale.set(scale);
    sprite.anchor.set(0.5, 0.5); // Центрируем
    
    console.log(`[BoardCanvas] Token sprite created for ${tokenId}, original: ${sprite.width}x${sprite.height}, scale: ${scale}, final: ${sprite.width * scale}x${sprite.height * scale}`);
    
    return sprite;
  } catch (error) {
    console.error(`[BoardCanvas] Failed to load token image for ${tokenId} from ${src}:`, error.message);
    console.error(`[BoardCanvas] Error details:`, error);
    // Fallback на дефолтный спрайт
    return createDefaultTokenSprite();
  }
}

// Создание дефолтного спрайта токена (круг)
function createDefaultTokenSprite() {
  const graphics = new PIXI.Graphics();
  graphics.circle(0, 0, 30);
  graphics.fill(0xffd700);
  graphics.stroke({ width: 3, color: 0xff8c00 });
  return graphics;
}

// Обновление токенов
async function updateTokens() {
  if (!worldContainer.value) return;

  console.log('[BoardCanvas] updateTokens called, tokens:', props.tokens);

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
    console.log(`[BoardCanvas] Processing token ${tokenId}:`, token);
    let sprite = tokenSprites.value.get(tokenId);
    
    if (!sprite) {
      console.log(`[BoardCanvas] Creating new sprite for token ${tokenId}`);
      // Загружаем изображение токена
      sprite = await loadTokenImage(tokenId, token);
      
      sprite.x = token.x || 0;
      sprite.y = token.y || 0;
      sprite.tokenId = tokenId;
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      
      tokenSprites.value.set(tokenId, sprite);
      worldContainer.value.addChild(sprite);
      
      console.log(`[BoardCanvas] Sprite added to container for token ${tokenId}`);
      
      // Настраиваем drag для нового токена
      setupTokenDrag(sprite);
    } else {
      // Обновляем позицию только если токен не перетаскивается
      if (boardState.draggedToken.value !== tokenId) {
        sprite.x = token.x || 0;
        sprite.y = token.y || 0;
      }
      
      // Если изменился src, перезагружаем изображение
      const currentSrc = sprite.texture?.baseTexture?.resource?.url || sprite.texture?.baseTexture?.resource?.src;
      if (token.src && currentSrc !== token.src) {
        // Удаляем старый спрайт
        worldContainer.value.removeChild(sprite);
        sprite.destroy();
        tokenSprites.value.delete(tokenId);
        
        // Создаем новый с новым изображением
        const newSprite = await loadTokenImage(tokenId, token);
        newSprite.x = token.x || 0;
        newSprite.y = token.y || 0;
        newSprite.tokenId = tokenId;
        newSprite.eventMode = 'static';
        newSprite.cursor = 'pointer';
        
        tokenSprites.value.set(tokenId, newSprite);
        worldContainer.value.addChild(newSprite);
        setupTokenDrag(newSprite);
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

// Обновление размера карты при изменении размера canvas
function updateMapSize() {
  if (!mapSprite.value || !app.value) return;
  
  const canvasWidth = app.value.screen.width;
  const canvasHeight = app.value.screen.height;
  mapSprite.value.width = canvasWidth;
  mapSprite.value.height = canvasHeight;
}

// Обработчик изменения размера окна
function handleResize() {
  if (!app.value || !canvasRef.value) return;
  
  const newWidth = canvasRef.value.clientWidth;
  const newHeight = canvasRef.value.clientHeight;
  
  app.value.renderer.resize(newWidth, newHeight);
  updateMapSize();
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
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
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