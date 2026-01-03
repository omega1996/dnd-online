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

const emit = defineEmits(["view", "add-token", "remove-token"]);

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
      v-if="character.imageUrl"
      :src="character.imageUrl"
      :alt="character.name"
      :style="{
        width: imageSize,
        height: imageSize,
        objectFit: 'cover',
        borderRadius: imageBorderRadius,
        border: '1px solid #ddd',
        cursor: 'pointer',
      }"
      @click="handleView"
      :title="'Click to view ' + character.name"
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
        {{ character.name }}
      </div>
      <div
        :style="{
          fontSize: statsFontSize,
          color: '#666',
        }"
      >
        HP: {{ character.stats?.health || 0 }} | AGI: {{ character.stats?.agility || 0 }} | STR:
        {{ character.stats?.strength || 0 }} | INT: {{ character.stats?.intelligence || 0 }}
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
        title="Remove token from board"
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
