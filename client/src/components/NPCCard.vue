<script setup>
import { computed } from "vue";

const props = defineProps({
  npc: {
    type: Object,
    required: true,
  },
  // Показывать ли кнопку "Add Token" (только для GM в GameScreen)
  showAddToken: {
    type: Boolean,
    default: false,
  },
  // Показывать ли кнопки редактирования и удаления (для создателя NPC)
  showEditDelete: {
    type: Boolean,
    default: false,
  },
  // ID текущего пользователя (для проверки, является ли он создателем)
  currentUserId: {
    type: String,
    default: null,
  },
  // Размер изображения (compact для GameScreen, normal для списка)
  size: {
    type: String,
    default: "normal", // "compact" | "normal"
    validator: (value) => ["compact", "normal"].includes(value),
  },
});

const emit = defineEmits(["view", "add-token", "edit", "delete"]);

// Получаем имя NPC
const npcName = computed(() => {
  return props.npc?.name || "Unknown";
});

// Получаем imageUrl
const imageUrl = computed(() => {
  return props.npc?.imageUrl || null;
});

// Получаем описание
const description = computed(() => {
  return props.npc?.description || "";
});

// Получаем статистику для отображения
const statsDisplay = computed(() => {
  if (props.npc?.stats) {
    return `HP: ${props.npc.stats.maxHitPoints || 0} | AGI: ${props.npc.stats.agility || 0} | STR: ${props.npc.stats.strength || 0} | INT: ${props.npc.stats.intelligence || 0}`;
  }
  return "No stats available";
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

// Padding карточки
const cardPadding = computed(() => {
  return props.size === "compact" ? "12px" : "16px";
});

// Gap между элементами
const cardGap = computed(() => {
  return props.size === "compact" ? "12px" : "16px";
});

// Проверяем, является ли текущий пользователь создателем NPC
const isOwner = computed(() => {
  return props.currentUserId && props.npc?.userId === props.currentUserId;
});

function handleView() {
  emit("view", props.npc);
}

function handleAddToken() {
  emit("add-token", props.npc);
}

function handleEdit() {
  emit("edit", props.npc);
}

function handleDelete() {
  emit("delete", props.npc);
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
      :alt="npcName"
      :style="{
        width: imageSize,
        height: imageSize,
        objectFit: 'cover',
        borderRadius: imageBorderRadius,
        border: '1px solid #ddd',
        cursor: 'pointer',
      }"
      @click="handleView"
      :title="'Click to view ' + npcName"
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
        {{ npcName }}
      </div>
      <div
        v-if="description && size === 'normal'"
        :style="{
          fontSize: '12px',
          color: '#666',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }"
      >
        {{ description }}
      </div>
      <div
        :style="{
          fontSize: statsFontSize,
          color: '#666',
        }"
      >
        {{ statsDisplay }}
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
        title="View NPC details"
      >
        View
      </button>
      <button
        v-if="showAddToken"
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
        title="Add NPC token to board"
      >
        Add Token
      </button>
      <button
        v-if="showEditDelete && isOwner"
        @click="handleEdit"
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
        title="Edit NPC"
      >
        Edit
      </button>
      <button
        v-if="showEditDelete && isOwner"
        @click="handleDelete"
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
        title="Delete NPC"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<style scoped>
button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
