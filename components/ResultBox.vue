<template>
  <div v-if="val && map[val]" class="result-box">
    <div class="text" :class="isOk ? 'ok' : 'ng'">{{ map[val] }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  val: string | null
  map: Record<string, string>
  isOk: boolean
}>()
</script>
