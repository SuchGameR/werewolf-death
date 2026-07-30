<template>
  <div class="player-card" :class="{ alive: isAlive, dead: !isAlive, me: isMe }">
    <div v-html="avatar" />
    <div class="player-info">
      <span>{{ userName }}<span v-if="isMe" class="text-sm text-muted"> (YOU)</span></span>
      <div v-if="starveDays != null && showStarve" class="starve-bar-wrap">
        <span :class="starveDays <= 0.5 ? 'starve-warn' : 'starve-ok'">{{ starveDays.toFixed(1) }}日</span>
        <div class="starve-bar"><div class="starve-bar-fill" :style="{ width: Math.min(100, (starveDays / 3) * 100) + '%' }" /></div>
      </div>
      <span v-if="isNailClipped" class="text-sm text-muted">⛓️爪切</span>
    </div>
    <span v-if="voted" class="vote-check">✓</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  userName: string
  isAlive: boolean
  isMe: boolean
  voted: boolean
  starveDays?: number
  isNailClipped?: boolean
  showStarve?: boolean
}>()

const { avatarHTML } = useUtils()
const avatar = computed(() => avatarHTML(props.userName, 28))
</script>
