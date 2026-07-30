<template>
  <div class="lobby-page">
    <header class="lobby-header">
      <h1>🐺 ロビー</h1>
      <div class="header-actions">
        <button class="btn btn-primary" @click="showCreate = true">部屋を作成</button>
        <button class="btn btn-secondary" @click="showJoin = true">部屋に参加</button>
      </div>
    </header>

    <div class="room-list">
      <div v-if="rooms.length === 0" class="empty">利用可能な部屋はありません</div>
      <div v-for="r in rooms" :key="r.roomCode" class="room-item" @click="quickJoin(r)">
        <div>
          <div class="room-item-name">{{ esc(r.roomName) }}</div>
          <div class="room-item-meta" v-html="nameWithAvatar(r.creatorName, 16) + ' · ' + (r.hasPassword ? '🔒 ' : '') + r.playerCount + '人参加中'" />
        </div>
        <span class="room-badge" :class="r.status === 'waiting' ? 'badge-waiting' : 'badge-playing'">
          {{ r.status === 'waiting' ? '待機中' : 'プレイ中' }}
        </span>
      </div>
    </div>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <form class="modal" @submit.prevent="createRoom">
        <h2>部屋を作成</h2>
        <input v-model="createForm.name" placeholder="あなたの名前" required />
        <input v-model="createForm.roomName" placeholder="部屋名" required />
        <input v-model="createForm.password" type="password" placeholder="パスワード（省略可）" />
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">作成</button>
          <button type="button" class="btn btn-ghost" @click="showCreate = false">キャンセル</button>
        </div>
      </form>
    </div>

    <div v-if="showJoin" class="modal-overlay" @click.self="showJoin = false">
      <form class="modal" @submit.prevent="joinRoom">
        <h2>部屋に参加</h2>
        <input v-model="joinForm.name" placeholder="あなたの名前" required />
        <input v-model="joinForm.code" placeholder="部屋コード" maxlength="8" style="text-transform:uppercase" required />
        <input v-model="joinForm.password" type="password" placeholder="パスワード（ある場合）" />
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">参加</button>
          <button type="button" class="btn btn-ghost" @click="showJoin = false">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface RoomInfo {
  roomCode: string
  roomName: string
  hasPassword: boolean
  creatorName: string
  status: string
  playerCount: number
}

const { esc, nameWithAvatar } = useUtils()
const { set: setStorage } = useStorage()
const toast = useToast()

const rooms = ref<RoomInfo[]>([])
const showCreate = ref(false)
const showJoin = ref(false)

const createForm = ref({ name: '', roomName: '', password: '' })
const joinForm = ref({ name: '', code: '', password: '' })

async function refreshList() {
  try {
    const data = await $fetch<{ success: boolean; rooms: RoomInfo[] }>('/api/rooms/list')
    if (data.success) rooms.value = data.rooms
  } catch {}
}

async function createRoom() {
  try {
    const data = await $fetch<{ success: boolean; room: any }>('/api/rooms/create', {
      method: 'POST',
      body: { roomName: createForm.value.roomName, password: createForm.value.password, creatorName: createForm.value.name }
    })
    if (!data.success) { toast.show('作成に失敗しました'); return }
    setStorage('wwUserName', createForm.value.name)
    setStorage('wwRoomCode', data.room.roomCode)
    setStorage('wwIsCreator', 'true')
    navigateTo(`/room/${data.room.roomCode}?name=${encodeURIComponent(createForm.value.name)}`)
  } catch { toast.show('作成に失敗しました', true) }
}

async function joinRoom() {
  try {
    const data = await $fetch<{ success: boolean; room: any }>('/api/rooms/join', {
      method: 'POST',
      body: { roomCode: joinForm.value.code.toUpperCase(), password: joinForm.value.password, userName: joinForm.value.name }
    })
    if (!data.success) { toast.show('参加に失敗しました'); return }
    setStorage('wwUserName', joinForm.value.name)
    setStorage('wwRoomCode', data.room.roomCode)
    navigateTo(`/room/${data.room.roomCode}?name=${encodeURIComponent(joinForm.value.name)}`)
  } catch (err: any) {
    toast.show(err?.message || '参加に失敗しました', true)
  }
}

async function quickJoin(r: RoomInfo) {
  const name = prompt('あなたの名前を入力してください:')
  if (!name?.trim()) return
  let password = ''
  if (r.hasPassword) {
    password = prompt('パスワードを入力してください:') || ''
  }
  try {
    const data = await $fetch<{ success: boolean; room: any }>('/api/rooms/join', {
      method: 'POST',
      body: { roomCode: r.roomCode, password, userName: name.trim() }
    })
    if (!data.success) { toast.show('参加に失敗しました'); return }
    setStorage('wwUserName', name.trim())
    setStorage('wwRoomCode', r.roomCode)
    navigateTo(`/room/${r.roomCode}?name=${encodeURIComponent(name.trim())}`)
  } catch { toast.show('参加に失敗しました', true) }
}

onMounted(() => {
  refreshList()
  setInterval(refreshList, 5000)
})
</script>
