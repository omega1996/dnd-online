<script setup>
import { computed } from "vue";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  npc: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close"]);

const npcName = computed(() => props.npc?.name || "Unknown");
const description = computed(() => props.npc?.description || "No description");
const imageUrl = computed(() => props.npc?.imageUrl || null);
const stats = computed(() => props.npc?.stats || {});

const labelStyle = { fontSize: '12px', color: '#666', marginBottom: '4px' };
const valueStyle = { fontSize: '18px', fontWeight: 600 };

function handleClose() {
  emit("close");
}
</script>

<template>
  <div
    v-if="visible && npc"
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
    @click.self="handleClose"
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
      <div
        :style="{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }"
      >
        <h3
          :style="{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: '#333',
          }"
        >
          {{ npcName }}
        </h3>
        <button
          @click="handleClose"
          :style="{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }"
        >
          ×
        </button>
      </div>

      <div v-if="imageUrl" :style="{ marginBottom: '20px', textAlign: 'center' }">
        <img
          :src="imageUrl"
          :alt="npcName"
          :style="{
            maxWidth: '100%',
            maxHeight: '300px',
            borderRadius: '8px',
            border: '1px solid #ddd',
          }"
        />
      </div>

      <div :style="{ marginBottom: '20px' }">
        <h4 :style="{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }">
          Description
        </h4>
        <p :style="{ margin: 0, color: '#666', lineHeight: '1.6' }">
          {{ description }}
        </p>
      </div>

      <div>
        <h4 :style="{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }">
          Statistics
        </h4>
        <div
          :style="{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }"
        >
          <div
            :style="{
              padding: '12px',
              background: '#f9f9f9',
              borderRadius: '6px',
              border: '1px solid #ddd',
            }"
          >
            <div :style="labelStyle">
              Max Hit Points
            </div>
            <div :style="valueStyle">
              {{ stats.maxHitPoints || 0 }}
            </div>
          </div>
          <div
            :style="{
              padding: '12px',
              background: '#f9f9f9',
              borderRadius: '6px',
              border: '1px solid #ddd',
            }"
          >
            <div :style="labelStyle">
              Agility
            </div>
            <div :style="valueStyle">
              {{ stats.agility || 0 }}
            </div>
          </div>
          <div
            :style="{
              padding: '12px',
              background: '#f9f9f9',
              borderRadius: '6px',
              border: '1px solid #ddd',
            }"
          >
            <div :style="labelStyle">
              Strength
            </div>
            <div :style="valueStyle">
              {{ stats.strength || 0 }}
            </div>
          </div>
          <div
            :style="{
              padding: '12px',
              background: '#f9f9f9',
              borderRadius: '6px',
              border: '1px solid #ddd',
            }"
          >
            <div :style="labelStyle">
              Intelligence
            </div>
            <div :style="valueStyle">
              {{ stats.intelligence || 0 }}
            </div>
          </div>
        </div>
      </div>

      <div
        :style="{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '24px',
        }"
      >
        <button
          @click="handleClose"
          :style="{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            background: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            color: '#333',
          }"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:hover {
  opacity: 0.9;
}
</style>
