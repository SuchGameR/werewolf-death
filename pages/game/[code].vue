<template>
  <div id="gameLayout" class="game-layout">
    <div class="game-main">
      <div class="top-bar">
        <span :class="'role-badge ' + roleClass(myRole)">{{ roleLabel(myRole) }}</span>
        <span class="phase-label">{{ phaseLabel(gameState?.phase) }}</span>
        <span class="turn-label">{{ gameState?.turn }}ターン目</span>
      </div>
      <TimerBar :remaining="timerRemaining" :duration="timerDuration" />
      <div id="actionPanel" v-html="panelHTML" />
      <div id="gameLog" class="game-log" ref="logRef">
        <div v-for="(entry, i) in gameState?.log" :key="i" class="log-entry">{{ entry.message }}</div>
      </div>
    </div>
    <div class="game-sidebar">
      <PlayerCard
        v-for="p in players"
        :key="p.name"
        :userName="p.name"
        :isAlive="p.isAlive"
        :isMe="p.name === userName"
        :voted="p.voted"
        :starveDays="p.starveDays"
        :isNailClipped="p.isNailClipped"
        :showStarve="p.showStarve"
      />
      <div id="spectatorSection" v-if="spectators.length" class="spectator-section">
        <div class="spec-label">観戦</div>
        <div v-for="s in spectators" :key="s" class="spectator-name">{{ s }}</div>
      </div>
      <ChatBox :messages="chatMessages" @send="sendChat" />
    </div>
    <div id="toast" class="toast" style="display:none" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSocket } from '~/composables/useSocket'
import { useStorage } from '~/composables/useStorage'
import { useGame } from '~/composables/useGame'
import { useToast } from '~/composables/useToast'
import type { GameState } from '~/composables/useGame'

const route = useRoute()
const socket = useSocket()
const storage = useStorage()
const toast = useToast()
const { esc, avatarHTML, roleLabel, roleClass, phaseLabel } = useUtils()
const { aliveNames, isAlive, hasVoted, voteProgressHTML } = useGame()

const roomCode = route.params.code as string
const userName = storage.get('wwUserName') || ''

if (!userName) {
  navigateTo('/lobby')
}

const myRole = ref('')
const gameState = ref<GameState | null>(null)
const timerRemaining = ref(0)
const timerDuration = ref(45)
const chatMessages = ref<{ userName: string; message: string }[]>([])
const logRef = ref<HTMLElement | null>(null)
const selectedTarget = ref('')

const players = computed(() => {
  const gs = gameState.value
  if (!gs) return []
  const list: { name: string; isAlive: boolean; starveDays: number; isNailClipped: boolean; voted: boolean; showStarve: boolean }[] = []
  gs.wolves.forEach(w => {
    list.push({
      name: w.name,
      isAlive: w.isAlive,
      starveDays: w.starveDays,
      isNailClipped: w.isNailClipped,
      voted: hasVoted(gs, w.name),
      showStarve: true
    })
  })
  if (gs.spy) {
    list.push({
      name: gs.spy.name,
      isAlive: gs.spy.isAlive,
      starveDays: 0,
      isNailClipped: false,
      voted: hasVoted(gs, gs.spy.name),
      showStarve: false
    })
  }
  return list
})

const spectators = computed(() => {
  return gameState.value?.spectators?.map((s: any) => typeof s === 'string' ? s : (s.userName || s.name)) || []
})

const panelHTML = computed(() => {
  const gs = gameState.value
  if (!gs) return ''
  const sel = selectedTarget.value
  const phase = gs.phase
  const role = myRole.value
  const myName = userName
  const alive = aliveNames(gs)
  const aliveWolves = gs.wolves.filter(w => w.isAlive)

  if (phase === 'attack_vote') {
    let html = '<div class="action-panel phase-attack">'
    html += `<div class="phase-title">${phaseLabel('attack_vote')}</div>`

    if (gs.skipNextAttack) {
      html += '<div class="phase-notice">通報によりスキップ</div>'
      html += '</div>'
      return html
    }

    html += '<div class="eligible-list">'
    aliveWolves.forEach(w => {
      html += `<div class="eligible-item">${avatarHTML(w.name, 24)}<span>${esc(w.name)}</span></div>`
    })
    html += '</div>'

    html += voteProgressHTML(gs, aliveWolves.map(w => w.name))

    html += ResultBoxHTML('lastAttackResult', gs.lastAttackResult)

    if (role === 'spy' && isAlive(gs, myName, role)) {
      html += '<div class="spy-abilities">'
      if (!gs.spy.flareUsed) {
        html += `<button class="btn btn-spy" onclick="ua('flare')">🚨 信号弾（襲撃阻止）</button>`
      }
      if (!gs.warningUsedThisTurn) {
        html += `<button class="btn btn-spy" onclick="ua('warning')">⚠️ 警告（成功率低下）</button>`
      }
      html += '</div>'
    }

    if (role === 'wolf' && isAlive(gs, myName, role) && !hasVoted(gs, myName)) {
      const wolf = gs.wolves.find(w => w.name === myName)
      if (wolf && !wolf.isNailClipped) {
        html += '<div class="vote-buttons">'
        html += `<button class="btn btn-yes" onclick="va('yes')">⭕ 襲撃する</button>`
        html += `<button class="btn btn-no" onclick="va('no')">❌ 襲撃しない</button>`
        html += '</div>'
      } else if (wolf && wolf.isNailClipped) {
        html += '<div class="phase-notice">⛓️ 爪切りのため行動不可</div>'
      }
    }

    html += '</div>'
    return html
  }

  if (phase === 'night_attack') {
    let html = '<div class="action-panel phase-night">'
    html += `<div class="phase-title">${phaseLabel('night_attack')}</div>`

    html += '<div class="eligible-list">'
    aliveWolves.forEach(w => {
      html += `<div class="eligible-item">${avatarHTML(w.name, 24)}<span>${esc(w.name)}</span></div>`
    })
    html += '</div>'

    html += voteProgressHTML(gs, aliveWolves.map(w => w.name))

    html += ResultBoxHTML('nightAttackResult', gs.nightAttackResult)

    if (role === 'spy' && isAlive(gs, myName, role) && !gs.spy.nailClipperUsed) {
      html += '<div class="spy-abilities">'
      html += `<button class="btn btn-spy" onclick="ua('nailClipper')">⛓️ 爪切り</button>`
      html += '</div>'
    }

    if (role === 'wolf' && isAlive(gs, myName, role) && !hasVoted(gs, myName)) {
      const wolf = gs.wolves.find(w => w.name === myName)
      if (wolf && !wolf.isNailClipped) {
        html += '<div class="vote-buttons">'
        html += '<div class="target-grid-title">襲撃対象を選択:</div>'
        html += '<div class="target-grid">'
        const targets = alive.filter(n => n !== myName)
        targets.forEach(t => {
          const selected = sel === t ? ' selected' : ''
          html += `<div class="target-cell${selected}" onclick="selTarget('${esc(t)}')">${avatarHTML(t, 32)}<span>${esc(t)}</span></div>`
        })
        html += '</div>'
        html += `<button class="btn btn-attack" onclick="doNight()">🗡️ 襲撃実行</button>`
        html += `<button class="btn btn-abstain" onclick="vn('')">⏭️ 棄権</button>`
        html += '</div>'
      } else if (wolf && wolf.isNailClipped) {
        html += '<div class="phase-notice">⛓️ 爪切りのため行動不可</div>'
      }
    }

    html += '</div>'
    return html
  }

  if (phase === 'report') {
    let html = '<div class="action-panel phase-report">'
    html += `<div class="phase-title">${phaseLabel('report')}</div>`

    if (gs.reportSkipped) {
      html += '<div class="phase-notice">放火によりスキップ</div>'
      html += '</div>'
      return html
    }

    html += voteProgressHTML(gs, [...alive])

    html += ResultBoxHTML('reportResult', gs.reportResult)

    if (role === 'spy' && isAlive(gs, myName, role) && !gs.spy.arsonUsed) {
      html += '<div class="spy-abilities">'
      html += `<button class="btn btn-spy" onclick="ua('arson')">🔥 放火（通報スキップ）</button>`
      html += '</div>'
    }

    if (isAlive(gs, myName, role) && !hasVoted(gs, myName)) {
      html += '<div class="vote-buttons">'
      html += `<button class="btn btn-yes" onclick="vr('yes')">⭕ 通報する</button>`
      html += `<button class="btn btn-no" onclick="vr('no')">❌ 通報しない</button>`
      html += '</div>'
    }

    html += '</div>'
    return html
  }

  return ''
})

function ResultBoxHTML(key: string, val: string | null): string {
  const map: Record<string, string> = {
    success: '成功',
    fail: '失敗',
    skipped: 'スキップ',
    spy_killed: 'スパイ発見・排除',
    wolf_killed: '同士討ち発生',
    failed: '失敗'
  }
  if (!val || !map[val]) return ''
  const isOk = val === 'success' || val === 'spy_killed'
  return `<div class="result-box"><div class="text ${isOk ? 'ok' : 'ng'}">${map[val]}</div></div>`
}

function sendChat(message: string) {
  socket.emit('chat-message', { roomCode, message })
}

function setupSocketHandlers() {
  socket.on('role-assign', (data: { role: string }) => {
    myRole.value = data.role
  })

  socket.on('game-state', (data: any) => {
    gameState.value = data as GameState
    if (data.winner) {
      navigateTo(`/result/${roomCode}`)
    }
  })

  socket.on('timer-tick', (data: { remaining: number; duration: number }) => {
    timerRemaining.value = data.remaining
    timerDuration.value = data.duration
  })

  socket.on('chat-message', (data: { userName: string; message: string }) => {
    chatMessages.value.push(data)
  })

  socket.on('error-msg', (msg: string) => {
    toast.show(msg, true)
  })
}

function removeSocketHandlers() {
  socket.off('role-assign')
  socket.off('game-state')
  socket.off('timer-tick')
  socket.off('chat-message')
  socket.off('error-msg')
}

onMounted(() => {
  setupSocketHandlers()

  socket.emit('join-room', { roomCode, userName })

  window.va = (vote: string) => socket.emit('vote-attack', { roomCode, vote })
  window.vr = (vote: string) => socket.emit('vote-report', { roomCode, vote })
  window.vn = (targetName: string) => socket.emit('vote-night-attack', { roomCode, targetName })
  window.ua = (ability: string, target?: string) => {
    if (ability === 'nailClipper') {
      const t = prompt('対象の人狼名を入力:')
      if (t) socket.emit('use-ability', { roomCode, ability, targetName: t })
    } else {
      socket.emit('use-ability', { roomCode, ability })
    }
  }
  window.selTarget = (name: string) => { selectedTarget.value = name }
  window.doNight = () => {
    if (selectedTarget.value) {
      socket.emit('vote-night-attack', { roomCode, targetName: selectedTarget.value })
      selectedTarget.value = ''
    }
  }
})

onUnmounted(() => {
  removeSocketHandlers()
  delete (window as any).va
  delete (window as any).vr
  delete (window as any).vn
  delete (window as any).ua
  delete (window as any).selTarget
  delete (window as any).doNight
})

watch(() => gameState.value?.log?.length, () => {
  nextTick(() => {
    if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
  })
})
</script>
