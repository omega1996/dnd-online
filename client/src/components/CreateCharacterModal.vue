<script setup>
import { ref, computed } from "vue";
import { useCharacters } from "../composables/useCharacters";
import { buildApiUrl, buildAssetUrl } from "../utils/api.js";

const props = defineProps({
  serverUrl: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close", "created"]);

const { createCharacter, loading } = useCharacters();

const name = ref("");
const imageFile = ref(null);
const jsonFile = ref(null);
const characterData = ref(null);
const isUploading = ref(false);
const useJsonData = ref(false);

const error = ref(null);

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

// Обработчик выбора JSON файла
async function handleJsonFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    if (!file.name.endsWith('.json')) {
      error.value = "Please select a JSON file";
      event.target.value = "";
      return;
    }
    
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      // Проверяем структуру
      // player_name может быть null или пустой строкой - это валидно
      // Главное - проверить наличие массива character с данными
      if (!parsed.character || !Array.isArray(parsed.character) || parsed.character.length === 0) {
        error.value = "Invalid DND character JSON structure: missing or empty character array";
        event.target.value = "";
        return;
      }
      
      jsonFile.value = file;
      characterData.value = parsed;
      useJsonData.value = true;
      
      // Автоматически заполняем имя из player_name или character_name
      // Если player_name отсутствует или null, используем character_name из первого персонажа
      if (parsed.player_name && parsed.player_name.trim()) {
        name.value = parsed.player_name;
      } else if (parsed.character[0]?.character_name) {
        name.value = parsed.character[0].character_name;
      }
      // Если оба отсутствуют, оставляем поле пустым для ручного ввода
      
      error.value = null;
    } catch (err) {
      error.value = "Failed to parse JSON file: " + err.message;
      event.target.value = "";
      return;
    }
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

// Создание персонажа
async function handleCreate() {
  if (!name.value.trim()) {
    error.value = "Please enter a character name";
    return;
  }

  if (!imageFile.value) {
    error.value = "Please select an image";
    return;
  }

  if (isUploading.value || loading.value) return;

  isUploading.value = true;
  error.value = null;

  try {
    // Загружаем изображение
    const imageUrl = await uploadImage(imageFile.value);

    // Если используется JSON данные, сохраняем полную структуру
    if (useJsonData.value && characterData.value) {
      // Обновляем image_url в character данных, если есть
      if (characterData.value.character && characterData.value.character[0]) {
        characterData.value.character[0].image_url = imageUrl;
      }
      
      // Сохраняем полную структуру DND
      await createCharacter({
        player_name: name.value.trim(),
        characterData: characterData.value,
        imageUrl,
      });
    } else {
      // Старый способ создания (для обратной совместимости)
      await createCharacter({
        name: name.value.trim(),
        imageUrl,
        stats: {
          health: 100,
          agility: 10,
          strength: 10,
          intelligence: 10,
        },
      });
    }

    // Очищаем форму
    name.value = "";
    imageFile.value = null;
    jsonFile.value = null;
    characterData.value = null;
    useJsonData.value = false;
    error.value = null;

    emit("created");
    emit("close");
  } catch (err) {
    console.error("Error creating character:", err);
    error.value = err.message || "Failed to create character";
  } finally {
    isUploading.value = false;
  }
}

function handleClose() {
  name.value = "";
  imageFile.value = null;
  jsonFile.value = null;
  characterData.value = null;
  useJsonData.value = false;
  error.value = null;
  emit("close");
}
</script>

<template>
  <div
    style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    "
    @click.self="handleClose"
  >
    <div
      style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      "
    >
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        "
      >
        <h2 style="margin: 0; font-size: 20px">Create Character</h2>
        <button
          @click="handleClose"
          style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          ×
        </button>
      </div>

      <div v-if="error" style="color: red; margin-bottom: 16px; font-size: 14px">
        {{ error }}
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px">
        <label style="display: flex; flex-direction: column; gap: 4px">
          <span style="font-weight: 500">Character Name *</span>
          <input
            v-model="name"
            type="text"
            placeholder="Enter character name"
            style="
              padding: 10px;
              border: 1px solid #ccc;
              border-radius: 6px;
              font-size: 14px;
            "
          />
        </label>

        <label style="display: flex; flex-direction: column; gap: 4px">
          <span style="font-weight: 500">Character Image *</span>
          <input
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            :disabled="isUploading"
            style="
              padding: 8px;
              border: 1px solid #ccc;
              border-radius: 6px;
              font-size: 13px;
            "
          />
          <small style="color: #666; font-size: 12px">
            Max 5MB (JPG, PNG, GIF, WebP, SVG)
          </small>
          <small
            v-if="imageFile"
            style="color: #28a745; font-size: 12px; margin-top: 4px"
          >
            Selected: {{ imageFile.name }} ({{
              (imageFile.size / 1024).toFixed(1)
            }}
            KB)
          </small>
        </label>

        <div style="border-top: 1px solid #eee; padding-top: 16px">
          <h3 style="margin: 0 0 12px 0; font-size: 16px">DND Character Data (Optional)</h3>
          <label style="display: flex; flex-direction: column; gap: 4px">
            <span style="font-weight: 500">Load DND Character JSON</span>
            <input
              type="file"
              accept=".json"
              @change="handleJsonFileSelect"
              :disabled="isUploading"
              style="
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 6px;
                font-size: 13px;
              "
            />
            <small style="color: #666; font-size: 12px">
              Upload a DND character JSON file generated by the character generator
            </small>
            <small
              v-if="jsonFile"
              style="color: #28a745; font-size: 12px; margin-top: 4px"
            >
              Loaded: {{ jsonFile.name }} ({{ (jsonFile.size / 1024).toFixed(1) }} KB)
            </small>
            <small
              v-if="useJsonData && characterData"
              style="color: #007bff; font-size: 12px; margin-top: 4px"
            >
              Character: {{ characterData.character?.[0]?.character_name || 'Unknown' }}
            </small>
          </label>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px">
          <button
            @click="handleClose"
            :disabled="isUploading || loading"
            style="
              padding: 10px 20px;
              border-radius: 6px;
              border: 1px solid #ccc;
              background: white;
              cursor: pointer;
              font-weight: 500;
            "
          >
            Cancel
          </button>
          <button
            @click="handleCreate"
            :disabled="!name.trim() || !imageFile || isUploading || loading"
            style="
              padding: 10px 20px;
              border-radius: 6px;
              border: none;
              background: #007bff;
              color: white;
              cursor: pointer;
              font-weight: 500;
            "
          >
            {{ isUploading || loading ? "Creating..." : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
