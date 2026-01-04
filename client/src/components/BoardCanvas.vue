<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as PIXI from 'pixi.js';
import { useBoardState } from '../composables/useBoardState';
import { buildAssetUrl } from '../utils/api.js';

const props = defineProps({
  mapSrc: {
    type: String,
    default: null
  },
  tokens: {
    type: Object,
    default: () => ({})
  },
  mapGrid: {
    type: Object,
    default: () => ({ rows: 10, columns: 10, enabled: true })
  },
  onTokenMove: {
    type: Function,
    required: true
  },
  onTokenClick: {
    type: Function,
    default: null
  },
  onTokenRightClick: {
    type: Function,
    default: null
  }
});

const canvasRef = ref(null);
const app = ref(null);
const worldContainer = ref(null);
const mapSprite = ref(null);
const tokenSprites = ref(new Map());
const resizeObserver = ref(null);
const gridGraphics = ref(null);
const isUpdatingTokens = ref(false);
const contextMenuHandler = ref(null);
const rightClickTokenId = ref(null); // ID токена, по которому был правый клик

const boardState = useBoardState();

// Преобразование координат сетки в пиксели
function gridToPixel(gridX, gridY) {
  if (!app.value || !props.mapGrid) {
    return { x: 0, y: 0 };
  }
  const canvasWidth = app.value.screen.width;
  const canvasHeight = app.value.screen.height;
  const cellWidth = canvasWidth / props.mapGrid.columns;
  const cellHeight = canvasHeight / props.mapGrid.rows;
  return {
    x: gridX * cellWidth + cellWidth / 2,
    y: gridY * cellHeight + cellHeight / 2
  };
}

// Преобразование пикселей в координаты сетки (с snap to grid)
function pixelToGrid(pixelX, pixelY) {
  if (!app.value || !props.mapGrid) {
    return { gridX: 0, gridY: 0 };
  }
  const canvasWidth = app.value.screen.width;
  const canvasHeight = app.value.screen.height;
  const cellWidth = canvasWidth / props.mapGrid.columns;
  const cellHeight = canvasHeight / props.mapGrid.rows;
  
  // Ограничиваем координаты в пределах сетки
  const gridX = Math.max(0, Math.min(props.mapGrid.columns - 1, Math.floor(pixelX / cellWidth)));
  const gridY = Math.max(0, Math.min(props.mapGrid.rows - 1, Math.floor(pixelY / cellHeight)));
  
  return { gridX, gridY };
}

// Инициализация PixiJS
async function initPixi() {
  if (!canvasRef.value) {
    console.warn('[BoardCanvas] canvasRef is null');
    return;
  }

  try {
    // Ждем, пока контейнер получит размеры
    await nextTick();
    
    // Используем размеры контейнера или fallback значения
    let width = canvasRef.value.clientWidth;
    let height = canvasRef.value.clientHeight;
    
    // Если размеры еще не установлены, ждем еще немного
    if (width === 0 || height === 0) {
      // Ждем следующего кадра
      await new Promise(resolve => {
        const checkSize = () => {
          if (canvasRef.value) {
            width = canvasRef.value.clientWidth;
            height = canvasRef.value.clientHeight;
            if (width > 0 && height > 0) {
              resolve();
            } else {
              requestAnimationFrame(checkSize);
            }
          } else {
            resolve();
          }
        };
        requestAnimationFrame(checkSize);
      });
      
      // Если все еще нет размеров, используем fallback
      if (width === 0 || height === 0) {
        width = 800;
        height = 600;
        console.warn('[BoardCanvas] Container has zero size, using fallback:', width, 'x', height);
      }
    }

    console.log('[BoardCanvas] Initializing with size:', width, 'x', height);

    app.value = new PIXI.Application();
    
    await app.value.init({
      width: width,
      height: height,
      backgroundColor: 0x2c3e50,
      antialias: true,
      resizeTo: undefined // Не используем автоматическое изменение размера
    });

    canvasRef.value.appendChild(app.value.canvas);

    // Создаем world контейнер для правильной работы координат
    worldContainer.value = new PIXI.Container();
    app.value.stage.addChild(worldContainer.value);

    // Загружаем карту если есть
    if (props.mapSrc) {
      await loadMap(props.mapSrc);
    }

    // Создаем сетку
    drawGrid();

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
    // Normalize URL: convert full URLs to relative paths to avoid Mixed Content issues
    const normalizedSrc = buildAssetUrl('', src);
    
    // Удаляем старую карту
    if (mapSprite.value) {
      worldContainer.value.removeChild(mapSprite.value);
      mapSprite.value.destroy();
      mapSprite.value = null;
    }

    // Загружаем текстуру
    const textureResource = await PIXI.Assets.load(normalizedSrc);
    
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
    
    // Перерисовываем сетку после загрузки карты
    drawGrid();
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

  let src = token.src.trim();
  // Normalize URL: convert full URLs to relative paths to avoid Mixed Content issues
  src = buildAssetUrl('', src);
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
  
  // Защита от одновременных вызовов
  if (isUpdatingTokens.value) {
    console.log('[BoardCanvas] updateTokens already in progress, skipping');
    return;
  }
  
  isUpdatingTokens.value = true;

  console.log('[BoardCanvas] updateTokens called, tokens:', props.tokens);

  const currentTokenIds = new Set(Object.keys(props.tokens));
  const spriteTokenIds = new Set(tokenSprites.value.keys());

  // Удаляем токены которых больше нет
  for (const tokenId of spriteTokenIds) {
    if (!currentTokenIds.has(tokenId)) {
      const sprite = tokenSprites.value.get(tokenId);
      if (sprite) {
        // Проверяем, что спрайт действительно в контейнере перед удалением
        if (sprite.parent === worldContainer.value) {
          worldContainer.value.removeChild(sprite);
        }
        sprite.destroy();
      }
      tokenSprites.value.delete(tokenId);
    }
  }

  // Добавляем/обновляем токены
  for (const [tokenId, token] of Object.entries(props.tokens)) {
    console.log(`[BoardCanvas] Processing token ${tokenId}:`, token);
    
    // Пропускаем скрытые токены
    if (token.hidden === true) {
      // Если спрайт существует и видим, скрываем его
      const sprite = tokenSprites.value.get(tokenId);
      if (sprite && sprite.parent === worldContainer.value) {
        worldContainer.value.removeChild(sprite);
        console.log(`[BoardCanvas] Hiding token ${tokenId}`);
      }
      continue;
    }
    
    let sprite = tokenSprites.value.get(tokenId);
    
    if (!sprite) {
      console.log(`[BoardCanvas] Creating new sprite for token ${tokenId}`);
      // Загружаем изображение токена
      sprite = await loadTokenImage(tokenId, token);
      
      // Преобразуем координаты сетки в пиксели
      const pixelPos = gridToPixel(token.gridX || 0, token.gridY || 0);
      sprite.x = pixelPos.x;
      sprite.y = pixelPos.y;
      sprite.tokenId = tokenId;
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      
      tokenSprites.value.set(tokenId, sprite);
      
      // Проверяем, что спрайт еще не добавлен в контейнер
      if (sprite.parent !== worldContainer.value) {
        worldContainer.value.addChild(sprite);
        console.log(`[BoardCanvas] Sprite added to container for token ${tokenId}`);
      } else {
        console.warn(`[BoardCanvas] Sprite for token ${tokenId} already in container!`);
      }
      
      // Настраиваем drag для нового токена
      setupTokenDrag(sprite);
    } else {
      // Проверяем, что спрайт добавлен в контейнер (если токен не скрыт)
      if (sprite.parent !== worldContainer.value) {
        console.log(`[BoardCanvas] Showing token ${tokenId} - adding sprite back to container`);
        worldContainer.value.addChild(sprite);
      }
      
      // Обновляем позицию только если токен не перетаскивается
      if (boardState.draggedToken.value !== tokenId) {
        const pixelPos = gridToPixel(token.gridX || 0, token.gridY || 0);
        sprite.x = pixelPos.x;
        sprite.y = pixelPos.y;
      }
      
      // Если изменился src, перезагружаем изображение
      const currentSrc = sprite.texture?.baseTexture?.resource?.url || sprite.texture?.baseTexture?.resource?.src;
      if (token.src && currentSrc !== token.src) {
        // Удаляем старый спрайт из контейнера, если он там есть
        if (sprite.parent === worldContainer.value) {
          worldContainer.value.removeChild(sprite);
        }
        sprite.destroy();
        tokenSprites.value.delete(tokenId);
        
        // Создаем новый с новым изображением
        const newSprite = await loadTokenImage(tokenId, token);
        const pixelPos = gridToPixel(token.gridX || 0, token.gridY || 0);
        newSprite.x = pixelPos.x;
        newSprite.y = pixelPos.y;
        newSprite.tokenId = tokenId;
        newSprite.eventMode = 'static';
        newSprite.cursor = 'pointer';
        
        tokenSprites.value.set(tokenId, newSprite);
        
        // Проверяем, что новый спрайт еще не добавлен
        if (newSprite.parent !== worldContainer.value) {
          worldContainer.value.addChild(newSprite);
        }
        setupTokenDrag(newSprite);
      }
    }
  }
  
  isUpdatingTokens.value = false;
}

// Настройка drag для токена
function setupTokenDrag(sprite) {
  if (!sprite) return;

  // Удаляем старые обработчики
  sprite.off('pointerdown');
  sprite.off('pointerup');
  sprite.off('pointerupoutside');

  let dragStartPos = null;
  const DRAG_THRESHOLD = 5; // Минимальное расстояние для начала drag

  sprite.on('pointerdown', (e) => {
    // Пропускаем правый клик (кнопка 2)
    if (e.button === 2) {
      return;
    }
    e.stopPropagation();
    const worldPos = globalToWorld(e.global.x, e.global.y);
    const token = props.tokens[sprite.tokenId];
    if (token) {
      const pixelPos = gridToPixel(token.gridX || 0, token.gridY || 0);
      dragStartPos = { x: worldPos.x, y: worldPos.y };
      boardState.startDragToken(sprite.tokenId, worldPos.x, worldPos.y, pixelPos.x, pixelPos.y);
      sprite.alpha = 0.7;
    }
  });

  sprite.on('pointerup', (e) => {
    if (boardState.draggedToken.value === sprite.tokenId) {
      sprite.alpha = 1;
      
      // Проверяем, был ли это drag или клик
      const worldPos = globalToWorld(e.global.x, e.global.y);
      const dragDistance = dragStartPos 
        ? Math.sqrt(
            Math.pow(worldPos.x - dragStartPos.x, 2) + 
            Math.pow(worldPos.y - dragStartPos.y, 2)
          )
        : 0;
      
      const finalPos = boardState.endDragToken();
      
      if (dragDistance < DRAG_THRESHOLD && finalPos) {
        // Это был клик, а не drag
        // Не открываем карточку персонажа, если это был правый клик
        if (rightClickTokenId.value !== sprite.tokenId && props.onTokenClick) {
          const token = props.tokens[sprite.tokenId];
          if (token && token.characterId) {
            props.onTokenClick(sprite.tokenId);
          }
        }
        // Сбрасываем флаг правого клика
        if (rightClickTokenId.value === sprite.tokenId) {
          rightClickTokenId.value = null;
        }
      } else if (finalPos) {
        // Это был drag
        const gridPos = pixelToGrid(finalPos.x, finalPos.y);
        props.onTokenMove(finalPos.tokenId, gridPos.gridX, gridPos.gridY);
      }
      
      dragStartPos = null;
    }
  });

  sprite.on('pointerupoutside', (e) => {
    if (boardState.draggedToken.value === sprite.tokenId) {
      sprite.alpha = 1;
      
      // Проверяем, был ли это drag или клик
      const worldPos = globalToWorld(e.global.x, e.global.y);
      const dragDistance = dragStartPos 
        ? Math.sqrt(
            Math.pow(worldPos.x - dragStartPos.x, 2) + 
            Math.pow(worldPos.y - dragStartPos.y, 2)
          )
        : 0;
      
      const finalPos = boardState.endDragToken();
      
      if (dragDistance < DRAG_THRESHOLD && finalPos) {
        // Это был клик, а не drag
        // Не открываем карточку персонажа, если это был правый клик
        if (rightClickTokenId.value !== sprite.tokenId && props.onTokenClick) {
          const token = props.tokens[sprite.tokenId];
          if (token && token.characterId) {
            props.onTokenClick(sprite.tokenId);
          }
        }
        // Сбрасываем флаг правого клика
        if (rightClickTokenId.value === sprite.tokenId) {
          rightClickTokenId.value = null;
        }
      } else if (finalPos) {
        // Это был drag
        const gridPos = pixelToGrid(finalPos.x, finalPos.y);
        props.onTokenMove(finalPos.tokenId, gridPos.gridX, gridPos.gridY);
      }
      
      dragStartPos = null;
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
        // При drag показываем позицию в пикселях, но при отпускании snap к сетке
        sprite.x = pos.x;
        sprite.y = pos.y;
      }
    }
  });

  // Обработка правого клика для контекстного меню
  if (canvasRef.value && app.value && !contextMenuHandler.value) {
    contextMenuHandler.value = (e) => {
      e.preventDefault();
      
      if (!props.onTokenRightClick) return;
      
      // Получаем координаты клика относительно canvas
      const rect = canvasRef.value.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Преобразуем координаты в мировые координаты PixiJS
      const worldPos = globalToWorld(x, y);
      
      // Проверяем, какой токен находится под курсором
      let clickedTokenId = null;
      for (const [tokenId, sprite] of tokenSprites.value.entries()) {
        if (!sprite || sprite.parent !== worldContainer.value) continue;
        
        // Проверяем расстояние от курсора до центра токена
        const distance = Math.sqrt(
          Math.pow(worldPos.x - sprite.x, 2) + 
          Math.pow(worldPos.y - sprite.y, 2)
        );
        
        // Используем радиус токена (примерно половина размера)
        const tokenRadius = Math.max(sprite.width, sprite.height) / 2;
        
        if (distance <= tokenRadius) {
          clickedTokenId = tokenId;
          break;
        }
      }
      
      if (clickedTokenId) {
        // Сохраняем ID токена, по которому был правый клик, чтобы предотвратить открытие карточки персонажа
        rightClickTokenId.value = clickedTokenId;
        props.onTokenRightClick(clickedTokenId, e.clientX, e.clientY);
        // Сбрасываем флаг через небольшую задержку, чтобы обычный клик не сработал
        setTimeout(() => {
          rightClickTokenId.value = null;
        }, 100);
      }
    };
    canvasRef.value.addEventListener('contextmenu', contextMenuHandler.value);
  }
}

// Отрисовка сетки
function drawGrid() {
  console.log('[BoardCanvas] drawGrid called', {
    hasWorldContainer: !!worldContainer.value,
    hasApp: !!app.value,
    mapGrid: props.mapGrid,
    mapGridEnabled: props.mapGrid?.enabled
  });

  if (!worldContainer.value || !app.value) {
    console.warn('[BoardCanvas] drawGrid: missing worldContainer or app');
    return;
  }

  // Проверяем, должна ли сетка быть видна
  if (!props.mapGrid || !props.mapGrid.enabled) {
    console.log('[BoardCanvas] Grid disabled, removing if exists');
    // Удаляем сетку если она отключена
    if (gridGraphics.value) {
      if (gridGraphics.value.parent === worldContainer.value) {
        worldContainer.value.removeChild(gridGraphics.value);
      }
      gridGraphics.value.destroy();
      gridGraphics.value = null;
    }
    return;
  }

  // Удаляем старую сетку
  if (gridGraphics.value) {
    if (gridGraphics.value.parent === worldContainer.value) {
      worldContainer.value.removeChild(gridGraphics.value);
    }
    gridGraphics.value.destroy();
    gridGraphics.value = null;
  }

  const canvasWidth = app.value.screen.width;
  const canvasHeight = app.value.screen.height;
  const rows = props.mapGrid.rows || 10;
  const columns = props.mapGrid.columns || 10;
  const cellWidth = canvasWidth / columns;
  const cellHeight = canvasHeight / rows;

  gridGraphics.value = new PIXI.Graphics();
  
  // Используем правильный синтаксис для PIXI.js v8
  // Рисуем линии как тонкие прямоугольники с заливкой (более надежный способ)
  // Вертикальные линии
  for (let i = 0; i <= columns; i++) {
    const x = Math.round(i * cellWidth);
    gridGraphics.value.rect(x, 0, 1, canvasHeight);
  }

  // Горизонтальные линии
  for (let i = 0; i <= rows; i++) {
    const y = Math.round(i * cellHeight);
    gridGraphics.value.rect(0, y, canvasWidth, 1);
  }

  // Применяем заливку ко всем прямоугольникам
  // В PIXI.js v8 нужно вызвать fill() после всех rect()
  gridGraphics.value.fill({ color: 0x808080, alpha: 1.0 });
  
  // Убеждаемся, что графика видна
  gridGraphics.value.visible = true;
  gridGraphics.value.alpha = 1.0;
  
  console.log('[BoardCanvas] Grid graphics created:', {
    bounds: gridGraphics.value.getBounds(),
    visible: gridGraphics.value.visible,
    alpha: gridGraphics.value.alpha
  });

  // Добавляем сетку поверх карты, но под токенами
  // Сетка должна быть последним элементом перед токенами
  if (mapSprite.value && mapSprite.value.parent === worldContainer.value) {
    const mapIndex = worldContainer.value.getChildIndex(mapSprite.value);
    worldContainer.value.addChildAt(gridGraphics.value, mapIndex + 1);
    console.log('[BoardCanvas] Grid added after map at index:', mapIndex + 1, 'total children:', worldContainer.value.children.length);
  } else {
    // Если карты нет, добавляем в начало
    worldContainer.value.addChildAt(gridGraphics.value, 0);
    console.log('[BoardCanvas] Grid added at index 0 (no map), total children:', worldContainer.value.children.length);
  }
  
  // Убеждаемся, что сетка видна
  gridGraphics.value.visible = true;
  gridGraphics.value.alpha = 1.0;
  
  console.log('[BoardCanvas] Grid drawn:', { 
    rows, 
    columns, 
    enabled: props.mapGrid.enabled, 
    width: canvasWidth, 
    height: canvasHeight,
    cellWidth,
    cellHeight,
    gridGraphicsExists: !!gridGraphics.value,
    gridGraphicsParent: gridGraphics.value?.parent === worldContainer.value,
    gridGraphicsVisible: gridGraphics.value?.visible,
    gridGraphicsAlpha: gridGraphics.value?.alpha,
    gridGraphicsBounds: gridGraphics.value?.getBounds()
  });
}

// Обновление размера карты при изменении размера canvas
function updateMapSize() {
  if (!mapSprite.value || !app.value) return;
  
  const canvasWidth = app.value.screen.width;
  const canvasHeight = app.value.screen.height;
  mapSprite.value.width = canvasWidth;
  mapSprite.value.height = canvasHeight;
  
  // Перерисовываем сетку при изменении размера
  drawGrid();
}

// Обработчик изменения размера контейнера
function handleResize() {
  if (!app.value || !canvasRef.value) return;
  
  const newWidth = canvasRef.value.clientWidth;
  const newHeight = canvasRef.value.clientHeight;
  
  if (newWidth > 0 && newHeight > 0 && (app.value.screen.width !== newWidth || app.value.screen.height !== newHeight)) {
    console.log('[BoardCanvas] Resizing from', app.value.screen.width, 'x', app.value.screen.height, 'to:', newWidth, 'x', newHeight);
    app.value.renderer.resize(newWidth, newHeight);
    updateMapSize();
    // Обновляем позиции токенов при изменении размера
    updateTokens();
  }
}

// Watchers
watch(() => props.mapSrc, (newSrc) => {
  if (newSrc && worldContainer.value) {
    loadMap(newSrc);
    drawGrid();
  }
});

watch(() => props.mapGrid, () => {
  if (worldContainer.value) {
    drawGrid();
    // Обновляем позиции токенов при изменении сетки
    updateTokens();
  }
}, { deep: true });

watch(() => props.tokens, () => {
  updateTokens();
}, { deep: true });

onMounted(async () => {
  // Небольшая задержка, чтобы контейнер успел получить размеры от родителя
  await nextTick();
  setTimeout(async () => {
    await initPixi();
    
    // Используем ResizeObserver для отслеживания изменений размеров контейнера
    if (canvasRef.value && window.ResizeObserver) {
      resizeObserver.value = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.value.observe(canvasRef.value);
    }
  }, 150);
  
  // Также слушаем изменения размера окна на случай, если ResizeObserver не поддерживается
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  
  if (resizeObserver.value && canvasRef.value) {
    resizeObserver.value.unobserve(canvasRef.value);
    resizeObserver.value.disconnect();
  }
  
  // Удаляем обработчик правого клика
  if (canvasRef.value && contextMenuHandler.value) {
    canvasRef.value.removeEventListener('contextmenu', contextMenuHandler.value);
    contextMenuHandler.value = null;
  }
  
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
  min-width: 100px;
  min-height: 100px;
  position: relative;
  overflow: hidden;
  flex: 1;
}
</style>