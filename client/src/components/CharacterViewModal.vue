<script setup>
import { computed } from "vue";

const props = defineProps({
  character: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const stats = computed(() => props.character?.stats || {
  health: 0,
  agility: 0,
  strength: 0,
  intelligence: 0,
});
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
    @click.self="$emit('close')"
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
        <h2 style="margin: 0; font-size: 20px">{{ character?.name || "Character" }}</h2>
        <button
          @click="$emit('close')"
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

      <div style="display: flex; flex-direction: column; gap: 20px">
        <!-- Изображение персонажа -->
        <div style="text-align: center">
          <img
            v-if="character?.imageUrl"
            :src="character.imageUrl"
            :alt="character.name"
            style="
              max-width: 200px;
              max-height: 200px;
              border-radius: 8px;
              border: 2px solid #ddd;
            "
          />
        </div>

        <!-- Характеристики -->
        <div>
          <h3 style="margin: 0 0 16px 0; font-size: 18px">Stats</h3>
          <div
            style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            "
          >
            <div
              style="
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
                text-align: center;
              "
            >
              <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                Health
              </div>
              <div style="font-size: 24px; font-weight: bold; color: #dc3545">
                {{ stats.health }}
              </div>
            </div>

            <div
              style="
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
                text-align: center;
              "
            >
              <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                Agility
              </div>
              <div style="font-size: 24px; font-weight: bold; color: #28a745">
                {{ stats.agility }}
              </div>
            </div>

            <div
              style="
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
                text-align: center;
              "
            >
              <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                Strength
              </div>
              <div style="font-size: 24px; font-weight: bold; color: #ffc107">
                {{ stats.strength }}
              </div>
            </div>

            <div
              style="
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
                text-align: center;
              "
            >
              <div style="font-size: 12px; color: #666; margin-bottom: 4px">
                Intelligence
              </div>
              <div style="font-size: 24px; font-weight: bold; color: #007bff">
                {{ stats.intelligence }}
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end">
          <button
            @click="$emit('close')"
            style="
              padding: 10px 20px;
              border-radius: 6px;
              border: 1px solid #ccc;
              background: white;
              cursor: pointer;
              font-weight: 500;
            "
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
