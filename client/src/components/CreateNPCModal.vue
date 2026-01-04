<script setup>
import { ref, watch, nextTick } from "vue";
import { useNPCs } from "../composables/useNPCs";
import { buildApiUrl, buildAssetUrl } from "../utils/api.js";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  serverUrl: {
    type: String,
    required: true,
  },
  npc: {
    type: Object,
    default: null, // Если передан, то редактирование, иначе создание
  },
});

const emit = defineEmits(["close", "created", "updated"]);

const { createNPC, updateNPC, loading } = useNPCs();

const name = ref("");
const description = ref("");
const imageFile = ref(null);
const imageUrl = ref("");
const maxHitPoints = ref(50);
const agility = ref(10);
const strength = ref(10);
const intelligence = ref(10);
const isUploading = ref(false);
const error = ref(null);
const inputRef = ref(null);

// Инициализация формы при открытии модального окна или изменении npc
watch(
  () => [props.visible, props.npc],
  ([visible, npc]) => {
    if (visible) {
      if (npc) {
        // Редактирование
        name.value = npc.name || "";
        description.value = npc.description || "";
        imageUrl.value = npc.imageUrl || "";
        maxHitPoints.value = npc.stats?.maxHitPoints || 50;
        agility.value = npc.stats?.agility || 10;
        strength.value = npc.stats?.strength || 10;
        intelligence.value = npc.stats?.intelligence || 10;
        imageFile.value = null;
      } else {
        // Создание нового
        name.value = "";
        description.value = "";
        imageFile.value = null;
        imageUrl.value = "";
        maxHitPoints.value = 50;
        agility.value = 10;
        strength.value = 10;
        intelligence.value = 10;
      }
      error.value = null;
      nextTick(() => {
        if (inputRef.value) {
          inputRef.value.focus();
        }
      });
    }
  },
  { immediate: true }
);

// Обработчик выбора изображения
function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    if (!file.type.startsWith("image/")) {
      error.value = "Please select an image file";
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      error.value = "File size must be less than 5MB";
      event.target.value = "";
      return;
    }
    imageFile.value = file;
    error.value = null;
  }
}

// Загрузка изображения на сервер
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(buildApiUrl(props.serverUrl, "/upload-token-image"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Upload failed" }));
    throw new Error(errorData.error || "Failed to upload image");
  }

  const data = await response.json();
  return buildAssetUrl(props.serverUrl, data.url);
}

// Создание или обновление NPC
async function handleSave() {
  if (!name.value.trim()) {
    error.value = "Please enter an NPC name";
    return;
  }

  if (!props.npc && !imageFile.value && !imageUrl.value) {
    error.value = "Please select an image";
    return;
  }

  if (isUploading.value || loading.value) return;

  isUploading.value = true;
  error.value = null;

  try {
    let finalImageUrl = imageUrl.value;

    // Если выбран новый файл, загружаем его
    if (imageFile.value) {
      finalImageUrl = await uploadImage(imageFile.value);
    }

    const npcData = {
      name: name.value.trim(),
      description: description.value.trim(),
      imageUrl: finalImageUrl,
      stats: {
        maxHitPoints: parseInt(maxHitPoints.value) || 50,
        agility: parseInt(agility.value) || 10,
        strength: parseInt(strength.value) || 10,
        intelligence: parseInt(intelligence.value) || 10,
      },
    };

    if (props.npc) {
      // Обновление существующего NPC
      await updateNPC(props.npc.id, npcData);
      emit("updated", props.npc.id);
    } else {
      // Создание нового NPC
      await createNPC(npcData);
      emit("created");
    }

    emit("close");
  } catch (err) {
    console.error("Error saving NPC:", err);
    error.value = err.message || "Failed to save NPC";
  } finally {
    isUploading.value = false;
  }
}

function handleCancel() {
  emit("close");
}

// Закрытие по Escape
function handleKeydown(event) {
  if (event.key === "Escape") {
    handleCancel();
  } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    handleSave();
  }
}
</script>

<template>
  <div
    v-if="visible"
    :style="{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      fontFamily: 'system-ui',
    }"
    @click.self="handleCancel"
    @keydown="handleKeydown"
  >
    <div
      :style="{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      }"
    >
      <h3
        :style="{
          margin: '0 0 20px 0',
          fontSize: '20px',
          fontWeight: 600,
          color: '#333',
        }"
      >
        {{ npc ? 'Edit NPC' : 'Create NPC' }}
      </h3>

      <div v-if="error" :style="{ color: '#dc3545', marginBottom: '16px', fontSize: '14px' }">
        {{ error }}
      </div>

      <div :style="{ display: 'flex', flexDirection: 'column', gap: '16px' }">
        <label>
          <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
            Name *
          </span>
          <input
            ref="inputRef"
            type="text"
            v-model="name"
            placeholder="Enter NPC name"
            :style="{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }"
          />
        </label>

        <label>
          <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
            Description
          </span>
          <textarea
            v-model="description"
            placeholder="Enter NPC description"
            rows="3"
            :style="{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }"
          />
        </label>

        <label>
          <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
            Image *
          </span>
          <input
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            :style="{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }"
          />
          <div v-if="imageUrl && !imageFile" :style="{ marginTop: '8px', fontSize: '12px', color: '#666' }">
            Current image: <img :src="imageUrl" :style="{ maxWidth: '100px', maxHeight: '100px', marginTop: '4px' }" />
          </div>
        </label>

        <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }">
          <label>
            <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
              Max HP
            </span>
            <input
              type="number"
              v-model.number="maxHitPoints"
              min="1"
              :style="{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }"
            />
          </label>

          <label>
            <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
              Agility
            </span>
            <input
              type="number"
              v-model.number="agility"
              min="1"
              max="20"
              :style="{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }"
            />
          </label>

          <label>
            <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
              Strength
            </span>
            <input
              type="number"
              v-model.number="strength"
              min="1"
              max="20"
              :style="{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }"
            />
          </label>

          <label>
            <span :style="{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }">
              Intelligence
            </span>
            <input
              type="number"
              v-model.number="intelligence"
              min="1"
              max="20"
              :style="{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }"
            />
          </label>
        </div>
      </div>

      <div
        :style="{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '24px',
        }"
      >
        <button
          @click="handleCancel"
          :disabled="isUploading || loading"
          :style="{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            background: 'white',
            cursor: isUploading || loading ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            color: '#333',
            opacity: isUploading || loading ? 0.5 : 1,
          }"
        >
          Cancel
        </button>
        <button
          @click="handleSave"
          :disabled="isUploading || loading"
          :style="{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            background: '#007bff',
            color: 'white',
            cursor: isUploading || loading ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            opacity: isUploading || loading ? 0.5 : 1,
          }"
        >
          {{ isUploading || loading ? 'Saving...' : (npc ? 'Update' : 'Create') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
input:focus,
textarea:focus {
  outline: none;
  border-color: #007bff !important;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
