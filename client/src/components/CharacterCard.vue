<script setup>
import { computed } from "vue";

const props = defineProps({
  character: {
    type: Object,
    required: true,
  },
  // Для проверки, находится ли токен на текущей доске
  roomTokens: {
    type: Object,
    default: () => ({}),
  },
  // ID текущего пользователя (для проверки владельца токена)
  currentUserId: {
    type: String,
    default: null,
  },
  // Показывать ли кнопку "Add Token" (только в GameScreen)
  showAddToken: {
    type: Boolean,
    default: false,
  },
  // Показывать ли кнопку "Remove Token" (только в GameScreen)
  showRemoveToken: {
    type: Boolean,
    default: false,
  },
  // Размер изображения (compact для GameScreen, normal для LoginScreen)
  size: {
    type: String,
    default: "normal", // "compact" | "normal"
    validator: (value) => ["compact", "normal"].includes(value),
  },
});

const emit = defineEmits(["view", "add-token", "remove-token", "hide-token", "show-token"]);

// Получаем имя персонажа (player_name или name для обратной совместимости)
const characterName = computed(() => {
  return props.character?.player_name || props.character?.name || "Unknown";
});

// Получаем imageUrl из правильного места
const imageUrl = computed(() => {
  return props.character?.imageUrl || 
         props.character?.characterData?.character?.[0]?.image_url || 
         null;
});

// Получаем abilities_bonuses для отображения
const abilitiesDisplay = computed(() => {
  // Если есть новая структура DND
  if (props.character?.characterData?.character?.[0]?.abilities_bonuses?.[0]) {
    const ab = props.character.characterData.character[0].abilities_bonuses[0];
    const abilities = ab.abilities || {};
    const bonuses = ab.bonuses || {};
    
    // Форматируем как: STR: 8(-1) DEX: 12(+1) CON: 14(+2) INT: 14(+2) WIS: 10(0) CHA: 17(+3)
    const formatStat = (key, value, bonus) => {
      const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
      return `${key.toUpperCase()}: ${value}(${bonusStr})`;
    };
    
    return [
      formatStat('STR', abilities.str || 0, bonuses.str || 0),
      formatStat('DEX', abilities.dex || 0, bonuses.dex || 0),
      formatStat('CON', abilities.con || 0, bonuses.con || 0),
      formatStat('INT', abilities.int || 0, bonuses.int || 0),
      formatStat('WIS', abilities.wis || 0, bonuses.wis || 0),
      formatStat('CHA', abilities.cha || 0, bonuses.cha || 0),
    ].join(' | ');
  }
  
  // Обратная совместимость со старой структурой
  if (props.character?.stats) {
    return `HP: ${props.character.stats.health || 0} | AGI: ${props.character.stats.agility || 0} | STR: ${props.character.stats.strength || 0} | INT: ${props.character.stats.intelligence || 0}`;
  }
  
  return "No stats available";
});

// Проверяем, есть ли токен этого персонажа на текущей доске
const isOnBoard = computed(() => {
  if (!props.character?.id || !props.roomTokens) {
    return false;
  }
  // Ищем токен с таким characterId в roomTokens
  return Object.values(props.roomTokens).some(
    (token) => token.characterId === props.character.id
  );
});

// Находим tokenId для этого персонажа на доске
const tokenOnBoard = computed(() => {
  if (!props.character?.id || !props.roomTokens) {
    return null;
  }
  const token = Object.values(props.roomTokens).find(
    (token) => token.characterId === props.character.id
  );
  return token || null;
});

// Проверяем, является ли текущий пользователь владельцем токена
const isTokenOwner = computed(() => {
  if (!tokenOnBoard.value || !props.currentUserId) {
    return false;
  }
  return tokenOnBoard.value.ownerId === props.currentUserId;
});

// Получаем hit points токена, если он на доске
const tokenHitPoints = computed(() => {
  if (!tokenOnBoard.value) {
    return null;
  }
  return tokenOnBoard.value.hitPoints;
});

// Проверяем, скрыт ли токен
const isTokenHidden = computed(() => {
  if (!tokenOnBoard.value) {
    return false;
  }
  return tokenOnBoard.value.hidden === true;
});

// Размеры изображения в зависимости от размера карточки
const imageSize = computed(() => {
  return props.size === "compact" ? "50px" : "60px";
});

// Размеры border-radius для изображения
const imageBorderRadius = computed(() => {
  return props.size === "compact" ? "4px" : "6px";
});

// Размер шрифта для имени
const nameFontSize = computed(() => {
  return props.size === "compact" ? "14px" : "16px";
});

// Размер шрифта для статистики
const statsFontSize = computed(() => {
  return props.size === "compact" ? "11px" : "12px";
});

// Размер шрифта для статуса "On board"
const statusFontSize = computed(() => {
  return props.size === "compact" ? "10px" : "11px";
});

// Padding карточки
const cardPadding = computed(() => {
  return props.size === "compact" ? "12px" : "16px";
});

// Gap между элементами
const cardGap = computed(() => {
  return props.size === "compact" ? "12px" : "16px";
});

function handleView() {
  emit("view", props.character);
}

function handleAddToken() {
  emit("add-token", props.character);
}

function handleRemoveToken() {
  if (tokenOnBoard.value) {
    emit("remove-token", tokenOnBoard.value.id);
  }
}

function handleHideToken() {
  if (tokenOnBoard.value) {
    emit("hide-token", tokenOnBoard.value.id);
  }
}

function handleShowToken() {
  if (tokenOnBoard.value) {
    emit("show-token", tokenOnBoard.value.id);
  }
}
</script>

<template>
  <div
    :style="{
      padding: cardPadding,
      background: 'white',
      borderRadius: props.size === 'compact' ? '6px' : '8px',
      border: '1px solid #ddd',
      display: 'flex',
      alignItems: 'center',
      gap: cardGap,
    }"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="characterName"
      :style="{
        width: imageSize,
        height: imageSize,
        objectFit: 'cover',
        borderRadius: imageBorderRadius,
        border: '1px solid #ddd',
        cursor: 'pointer',
      }"
      @click="handleView"
      :title="'Click to view ' + characterName"
    />
    <div :style="{ flex: size === 'compact' ? '1 1 0' : '1', minWidth: 0 }">
      <div
        :style="{
          fontWeight: 500,
          fontSize: nameFontSize,
          marginBottom: size === 'compact' ? '4px' : '4px',
          cursor: 'pointer',
        }"
        @click="handleView"
      >
        {{ characterName }}
      </div>
      <div
        :style="{
          fontSize: statsFontSize,
          color: '#666',
        }"
      >
        {{ abilitiesDisplay }}
      </div>
      <div
        v-if="isOnBoard"
        :style="{
          fontSize: statusFontSize,
          color: '#28a745',
          marginTop: '4px',
        }"
      >
        ✓ On board
        <span v-if="tokenHitPoints !== null" :style="{ marginLeft: '8px', fontWeight: 600 }">
          HP: {{ tokenHitPoints }}
        </span>
      </div>
    </div>
    <div
      :style="{
        display: 'flex',
        gap: '4px',
        flexDirection: size === 'compact' ? 'column' : 'row',
      }"
    >
      <button
        @click="handleView"
        :style="{
          padding: size === 'compact' ? '4px 8px' : '6px 12px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: 'white',
          color: '#666',
          cursor: 'pointer',
          fontSize: size === 'compact' ? '11px' : '12px',
          whiteSpace: 'nowrap',
        }"
        title="View character details"
      >
        View
      </button>
      <button
        v-if="showAddToken && !isOnBoard"
        @click="handleAddToken"
        :style="{
          padding: size === 'compact' ? '4px 8px' : '6px 12px',
          borderRadius: '4px',
          border: 'none',
          background: '#007bff',
          color: 'white',
          cursor: 'pointer',
          fontSize: size === 'compact' ? '11px' : '12px',
          whiteSpace: 'nowrap',
        }"
        title="Add character token to board"
      >
        Add Token
      </button>
      <button
        v-if="showRemoveToken && isOnBoard && isTokenOwner"
        @click="isTokenHidden ? handleShowToken() : handleHideToken()"
        :style="{
          padding: size === 'compact' ? '4px 8px' : '6px 12px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: 'white',
          color: '#666',
          cursor: 'pointer',
          fontSize: size === 'compact' ? '11px' : '12px',
          whiteSpace: 'nowrap',
        }"
        :title="isTokenHidden ? 'Show token on board' : 'Hide token from board'"
      >
        {{ isTokenHidden ? 'Show' : 'Hide' }}
      </button>
      <button
        v-if="showRemoveToken && isOnBoard && isTokenOwner"
        @click="handleRemoveToken"
        :style="{
          padding: size === 'compact' ? '4px 8px' : '6px 12px',
          borderRadius: '4px',
          border: 'none',
          background: '#dc3545',
          color: 'white',
          cursor: 'pointer',
          fontSize: size === 'compact' ? '11px' : '12px',
          whiteSpace: 'nowrap',
        }"
        title="Remove token from board (death)"
      >
        Remove
      </button>
    </div>
  </div>
</template>

<style scoped>
button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
