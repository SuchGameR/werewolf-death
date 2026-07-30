<template>
  <div class="timer-bar-container">
    <div id="timerBarFill" class="timer-bar-fill" :style="{ width: pct + '%' }" />
    <span id="timerText" class="timer-text" :class="{ urgent: remaining <= 10 }">{{ remaining }}s</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  remaining: number
  duration: number
}>()

const pct = computed(() => Math.max(0, (props.remaining / (props.duration || 1)) * 100))
</script>
