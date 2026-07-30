import { Server as SocketIOServer } from 'socket.io'

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  compatibilityDate: '2026-07-30',
  css: ['~/assets/css/style.css'],
  vite: {
    server: { hmr: { clientPort: 24678 } }
  },
  nitro: {
    preset: 'node-server'
  },
  hooks: {
    'listen'(server: any, listener: any) {
      const io = new SocketIOServer(server, {
        cors: { origin: true, credentials: true }
      })
      ;(globalThis as any).__io = io
      setupSocketHandlers(io)
    }
  }
})

async function setupSocketHandlers(io: SocketIOServer) {
  const { db } = await import('./server/utils/database')
  const { gameEngine } = await import('./server/utils/gameEngine')

  const PHASE_TIMERS: Record<string, number> = {
    attack_vote: 45,
    night_attack: 45,
    report: 30,
    starvation_check: 2,
    win_check: 2
  }
  const roomTimers = new Map<string, ReturnType<typeof setInterval>>()

  function clearPhaseTimer(roomCode: string) {
    const existing = roomTimers.get(roomCode)
    if (existing) {
      clearInterval(existing)
      roomTimers.delete(roomCode)
    }
  }

  function autoResolvePhase(roomCode: string, phase: string) {
    switch (phase) {
      case 'attack_vote': gameEngine.autoResolveAttackVote(roomCode); break
      case 'night_attack': gameEngine.autoResolveNightAttack(roomCode); break
      case 'report': gameEngine.autoResolveReport(roomCode); break
    }
    emitGameState(roomCode)
  }

  function startPhaseTimer(roomCode: string, phase: string) {
    clearPhaseTimer(roomCode)
    const duration = PHASE_TIMERS[phase] || 45
    let remaining = duration
    const timer = setInterval(() => {
      remaining--
      io.to(roomCode).emit('timer-tick', { remaining, duration })
      if (remaining <= 0) {
        clearInterval(timer)
        roomTimers.delete(roomCode)
        autoResolvePhase(roomCode, phase)
      }
    }, 1000)
    roomTimers.set(roomCode, timer)
    io.to(roomCode).emit('timer-tick', { remaining: duration, duration })
  }

  function emitGameState(roomCode: string) {
    clearPhaseTimer(roomCode)
    const gs = gameEngine.getState(roomCode)
    if (!gs) return
    const fullState = { ...gs, spectators: db.getRoomSpectators(roomCode) || [] }
    io.to(roomCode).emit('game-state', fullState)
    db.saveGameState(roomCode, gs)
    if (gs.phase !== 'ended' && !gs.winner) {
      startPhaseTimer(roomCode, gs.phase)
    }
  }

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomCode, userName }: { roomCode: string; userName: string }) => {
      const room = db.getRoom(roomCode)
      if (!room) return socket.emit('error-msg', '部屋が見つかりません')

      if (room.status === 'playing') {
        const players = db.getRoomPlayers(roomCode)
        const existing = players.find(p => p.userName === userName)
        if (existing) {
          db.addPlayerToRoom(roomCode, userName, socket.id)
          socket.join(roomCode)
          socket.emit('role-assign', { role: existing.role })
          io.to(roomCode).emit('room-update', {
            players: db.getRoomPlayers(roomCode),
            spectators: db.getRoomSpectators(roomCode),
            roomStatus: room.status
          })
          emitGameState(roomCode)
          return
        }
        db.addSpectator(roomCode, userName, socket.id)
        socket.join(roomCode)
        socket.emit('role-assign', { role: 'spectator' })
        io.to(roomCode).emit('room-update', {
          players: db.getRoomPlayers(roomCode),
          spectators: db.getRoomSpectators(roomCode),
          roomStatus: room.status
        })
        emitGameState(roomCode)
        return
      }

      db.addPlayerToRoom(roomCode, userName, socket.id)
      socket.join(roomCode)
      io.to(roomCode).emit('room-update', {
        players: db.getRoomPlayers(roomCode),
        spectators: db.getRoomSpectators(roomCode),
        roomStatus: room.status
      })
    })

    socket.on('leave-room', ({ roomCode }: { roomCode: string }) => {
      db.removePlayerFromRoom(roomCode, socket.id)
      db.removeSpectator(roomCode, socket.id)
      socket.leave(roomCode)
      io.to(roomCode).emit('room-update', {
        players: db.getRoomPlayers(roomCode),
        spectators: db.getRoomSpectators(roomCode)
      })
    })

    socket.on('update-settings', ({ roomCode, settings }: { roomCode: string; settings: any }) => {
      db.updateRoomSettings(roomCode, settings)
      io.to(roomCode).emit('settings-updated', settings)
    })

    socket.on('start-game', ({ roomCode }: { roomCode: string }) => {
      const room = db.getRoom(roomCode)
      if (!room) return
      const players = db.getRoomPlayers(roomCode)
      const connectedPlayers = players.filter(p => p.isConnected)
      if (connectedPlayers.length < 3) {
        io.to(roomCode).emit('error-msg', '3人以上必要です')
        return
      }
      try {
        const gs = gameEngine.initGame(roomCode, connectedPlayers, room.settings)
        gameEngine.beginAttackPhase(roomCode)
        db.updateRoomStatus(roomCode, 'playing')
        db.saveGameState(roomCode, gs)
        connectedPlayers.forEach(p => {
          const role = gs.playerRoles[p.userName]
          p.role = role
          io.to(p.socketId).emit('role-assign', { role })
        })
        emitGameState(roomCode)
        io.to(roomCode).emit('room-update', {
          players: db.getRoomPlayers(roomCode),
          spectators: db.getRoomSpectators(roomCode),
          roomStatus: 'playing'
        })
      } catch (err: any) {
        io.to(roomCode).emit('error-msg', err.message)
      }
    })

    socket.on('vote-attack', ({ roomCode, vote }: { roomCode: string; vote: string }) => {
      const players = db.getRoomPlayers(roomCode)
      const p = players.find(x => x.socketId === socket.id)
      if (!p) return
      const result = gameEngine.handleVoteAttack(roomCode, p.userName, vote)
      if (result.error) return socket.emit('error-msg', result.error)
      emitGameState(roomCode)
    })

    socket.on('vote-night-attack', ({ roomCode, targetName }: { roomCode: string; targetName: string }) => {
      const players = db.getRoomPlayers(roomCode)
      const p = players.find(x => x.socketId === socket.id)
      if (!p) return
      const result = gameEngine.handleVoteNightAttack(roomCode, p.userName, targetName)
      if (result.error) return socket.emit('error-msg', result.error)
      emitGameState(roomCode)
    })

    socket.on('vote-report', ({ roomCode, vote }: { roomCode: string; vote: string }) => {
      const players = db.getRoomPlayers(roomCode)
      const p = players.find(x => x.socketId === socket.id)
      if (!p) return
      const result = gameEngine.handleVoteReport(roomCode, p.userName, vote)
      if (result.error) return socket.emit('error-msg', result.error)
      emitGameState(roomCode)
    })

    socket.on('use-ability', ({ roomCode, ability, targetName }: { roomCode: string; ability: string; targetName?: string }) => {
      const players = db.getRoomPlayers(roomCode)
      const p = players.find(x => x.socketId === socket.id)
      if (!p) return
      const result = gameEngine.handleSpyAbility(roomCode, p.userName, ability, targetName)
      if (result.error) return socket.emit('error-msg', result.error)
      emitGameState(roomCode)
    })

    socket.on('force-end', ({ roomCode }: { roomCode: string }) => {
      const players = db.getRoomPlayers(roomCode)
      const p = players.find(x => x.socketId === socket.id)
      if (!p) return
      const room = db.getRoom(roomCode)
      if (!room) return
      if (p.userName !== room.creatorName) return socket.emit('error-msg', '部屋作成者のみ強制終了できます')
      gameEngine.forceEnd(roomCode)
      emitGameState(roomCode)
    })

    socket.on('chat-message', ({ roomCode, message }: { roomCode: string; message: string }) => {
      const players = db.getRoomPlayers(roomCode)
      const p = players.find(x => x.socketId === socket.id)
      if (!p) return
      io.to(roomCode).emit('chat-message', { userName: p.userName, message, timestamp: Date.now() })
    })

    socket.on('disconnect', () => {
      for (const [roomCode, players] of db.roomPlayers) {
        const idx = players.findIndex(p => p.socketId === socket.id)
        if (idx >= 0) {
          players[idx].isConnected = false
          io.to(roomCode).emit('room-update', {
            players: db.getRoomPlayers(roomCode),
            spectators: db.getRoomSpectators(roomCode)
          })
        }
      }
      for (const [roomCode, spectators] of db.roomSpectators) {
        const idx = spectators.findIndex(s => s.socketId === socket.id)
        if (idx >= 0) spectators.splice(idx, 1)
      }
    })
  })
}
