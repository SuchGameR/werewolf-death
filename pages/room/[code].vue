<template>
  <div class="room-page">
    <header class="room-header">
      <div>
        <h1>{{ room?.roomName || '部屋' }}</h1>
        <p class="text-muted">コード: <strong>{{ roomCode }}</strong></p>
      </div>
      <div class="header-actions">
        <button v-if="isCreator && roomStatus === 'waiting'" class="btn btn-primary" :disabled="connectedCount < 3" @click="startGame">
          ゲーム開始 ({{ connectedCount }}/{{ maxPlayers }})
        </button>
        <button class="btn btn-ghost" @click="leaveRoom">退出</button>
      </div>
    </header>

    <div v-if="isCreator && roomStatus === 'waiting'" class="settings-section">
      <h3>設定</h3>
      <div class="settings-row">
        <label>人狼数</label>
        <input v-model.number="settings.wolfCount" type="number" min="1" max="10" class="input-sm" />
        <label>最大人数</label>
        <input v-model.number="settings.maxPlayers" type="number" min="3" max="20" class="input-sm" />
        <button class="btn btn-sm" @click="saveSettings">保存</button>
      </div>
    </div>

    <div class="room-content">
      <div class="players-section">
        <h3>プレイヤー ({{ connectedCount }})</h3>
        <div class="players-grid">
          <div v-for="p in connectedPlayers" :key="p.userName" class="player-entry">
            <div v-html="avatarHTML(p.userName, 32)" />
            <span class="name-with-avatar">
              <span class="name-text">{{ p.userName }}<span v-if="p.userName === userName" class="text-sm text-muted"> (YOU)</span></span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="spectators.length > 0" class="spectator-section">
        <h3>観戦者 ({{ spectators.length }})</h3>
        <div class="players-grid">
          <div v-for="s in spectators" :key="s.userName" class="player-entry">
            <div v-html="avatarHTML(s.userName, 28)" />
            <span class="name-with-avatar"><span class="name-text">{{ s.userName }}</span></span>
          </div>
        </div>
      </div>
    </div>

    <div id="toast" class="toast" style="display:none" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const route = useRoute()
const router = useRouter()

const { esc, avatarHTML, nameWithAvatar } = useUtils()
const { get: getStorage, set: setStorage } = useStorage()
const toast = useToast()
const socket = useSocket()

const roomCode = (route.params.code as string) || getStorage('wwRoomCode') || ''
const userName = (route.query.name as string) || getStorage('wwUserName') || ''

if (!roomCode || !userName) {
  navigateTo('/lobby')
}

const room = ref<any>(null)
const isCreator = ref(getStorage('wwIsCreator') === 'true')
const roomStatus = ref('waiting')
const players = ref<any[]>([])
const spectators = ref<any[]>([])
const settings = ref({ wolfCount: 3, maxPlayers: 8 })

const connectedPlayers = computed(() => players.value.filter(p => p.isConnected))
const connectedCount = computed(() => connectedPlayers.value.length)
const maxPlayers = computed(() => settings.value.maxPlayers)

async function fetchRoom() {
  try {
    const data = await $fetch<{ success: boolean; room: any }>(`/api/rooms/${roomCode}`)
    if (!data.success) { navigateTo('/lobby'); return }
    room.value = data.room
    roomStatus.value = data.room.status
    settings.value = data.room.settings || settings.value
    if (data.room.status === 'playing') {
      navigateTo(`/game/${roomCode}?name=${encodeURIComponent(userName)}`)
      return
    }
    if (data.room.status === 'finished') {
      navigateTo(`/result/${roomCode}`)
      return
    }
  } catch { navigateTo('/lobby') }
}

function saveSettings() {
  socket.emit('update-settings', { roomCode, settings: settings.value })
}

function startGame() {
  if (roomStatus.value !== 'waiting') return
  socket.emit('start-game', { roomCode })
}

function leaveRoom() {
  setStorage('wwRoomCode', '')
  socket.emit('leave-room', { roomCode })
  navigateTo('/lobby')
}

function copyCode() {
  navigator.clipboard.writeText(roomCode).then(() => toast.show('コピーしました')).catch(() => {})
}

onMounted(() => {
  fetchRoom()
  socket.emit('join-room', { roomCode, userName })

  socket.on('room-update', (data: any) => {
    players.value = data.players || []
    spectators.value = data.spectators || []
    roomStatus.value = data.roomStatus || roomStatus.value
    if (roomStatus.value === 'playing') {
      navigateTo(`/game/${roomCode}?name=${encodeURIComponent(userName)}`)
    }
  })

  socket.on('settings-updated', (s: any) => {
    settings.value = s
    toast.show('設定を保存しました')
  })
})

onUnmounted(() => {
  socket.off('room-update')
  socket.off('settings-updated')
})
</script>
