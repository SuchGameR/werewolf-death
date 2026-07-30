<template>
  <div class="result-page">
    <div class="result-card" :class="winnerClass">
      <div class="result-icon">{{ winnerIcon }}</div>
      <h1>{{ winnerText }}</h1>
      <p class="result-subtitle">{{ winnerSubtext }}</p>

      <div class="result-details">
        <div v-for="p in allPlayers" :key="p.n" class="result-player" :class="{ winner: p.role === winningRole }">
          <div v-html="avatarHTML(p.n, 32)" />
          <span class="name-text">{{ p.n }}</span>
          <span :class="'role-badge ' + (p.role === 'wolf' ? 'role-wolf' : 'role-spy')">
            {{ p.role === 'wolf' ? '🐺 人狼' : '🕵️ スパイ' }}
          </span>
          <span v-if="p.a" class="alive-mark">生存</span>
          <span v-else class="dead-mark">死亡</span>
        </div>
      </div>

      <button class="btn btn-primary" @click="goLobby">ロビーに戻る</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const route = useRoute()
const { avatarHTML } = useUtils()

const roomCode = route.params.code as string

const gameState = ref<any>(null)

const allPlayers = computed(() => {
  if (!gameState.value) return []
  const list: { n: string; role: string; a: boolean }[] = []
  ;(gameState.value.wolves || []).forEach((w: any) => list.push({ n: w.name, role: 'wolf', a: w.isAlive }))
  if (gameState.value.spy) list.push({ n: gameState.value.spy.name, role: 'spy', a: gameState.value.spy.isAlive })
  return list
})

const winningRole = computed(() => {
  if (gameState.value?.winner === 'wolf') return 'wolf'
  if (gameState.value?.winner === 'human') return 'spy'
  return null
})

const winnerClass = computed(() => {
  if (gameState.value?.winner === 'wolf') return 'wolf-win'
  if (gameState.value?.winner === 'human') return 'spy-win'
  return ''
})

const winnerIcon = computed(() => {
  if (gameState.value?.winner === 'wolf') return '🐺'
  if (gameState.value?.winner === 'human') return '🕵️'
  return '🏁'
})

const winnerText = computed(() => {
  if (gameState.value?.winner === 'wolf') return '人狼の勝利'
  if (gameState.value?.winner === 'human') return 'スパイの勝利'
  return 'ゲーム終了'
})

const winnerSubtext = computed(() => {
  if (gameState.value?.winner === 'wolf') return 'スパイは排除された…'
  if (gameState.value?.winner === 'human') return '全人狼が飢え、もしくは倒れた…'
  return ''
})

function goLobby() {
  navigateTo('/lobby')
}

onMounted(() => {
  const saved = sessionStorage.getItem('wwResult')
  if (saved) {
    try { gameState.value = JSON.parse(saved) } catch {}
  }
})
</script>
