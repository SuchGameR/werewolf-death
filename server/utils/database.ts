import fs from 'fs'
import path from 'path'

export interface PlayerData {
  userName: string
  socketId: string
  role: string | null
  isAlive: boolean
  isConnected: boolean
}

export interface SpectatorData {
  userName: string
  socketId: string
}

export interface RoomData {
  id: number
  roomCode: string
  roomName: string
  password: string | null
  creatorName: string
  status: string
  settings: any
  gameState: any
  createdAt: string
}

interface StoredRoom {
  id: number
  room_code: string
  room_name: string
  password: string | null
  creator_name: string
  status: string
  settings: string
  game_state: string | null
  created_at: string
}

class JsonDatabase {
  private dbPath: string
  private data: StoredRoom[] = []
  private nextId = 1
  roomPlayers = new Map<string, PlayerData[]>()
  roomSpectators = new Map<string, SpectatorData[]>()

  constructor() {
    this.dbPath = path.join(process.cwd(), 'werewolf.json')
  }

  init() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf-8')
        this.data = JSON.parse(raw)
        this.nextId = this.data.reduce((max, r) => Math.max(max, r.id), 0) + 1
      } catch {
        this.data = []
      }
    }
  }

  private save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  createRoom(roomName: string, password: string, creatorName: string) {
    const roomCode = this.generateRoomCode()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const row: StoredRoom = {
      id: this.nextId++,
      room_code: roomCode,
      room_name: roomName,
      password: password || null,
      creator_name: creatorName,
      status: 'waiting',
      settings: JSON.stringify({ wolfCount: 3, maxPlayers: 8 }),
      game_state: null,
      created_at: now
    }
    this.data.push(row)
    this.save()
    return {
      id: row.id, roomCode, roomName,
      hasPassword: !!password, creatorName, status: 'waiting' as const
    }
  }

  getRoom(roomCode: string): RoomData | null {
    const row = this.data.find(r => r.room_code === roomCode)
    if (!row) return null
    return {
      id: row.id, roomCode: row.room_code, roomName: row.room_name,
      password: row.password, creatorName: row.creator_name,
      status: row.status, settings: JSON.parse(row.settings || '{}'),
      gameState: row.game_state ? JSON.parse(row.game_state) : null,
      createdAt: row.created_at
    }
  }

  getAllRooms() {
    const active = this.data.filter(r => r.status !== 'finished')
    active.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return active.map(row => ({
      roomCode: row.room_code, roomName: row.room_name,
      hasPassword: !!row.password, creatorName: row.creator_name,
      status: row.status, createdAt: row.created_at,
      playerCount: this.roomPlayers.get(row.room_code)?.length || 0
    }))
  }

  updateRoomSettings(roomCode: string, settings: any) {
    const row = this.data.find(r => r.room_code === roomCode)
    if (row) { row.settings = JSON.stringify(settings); this.save() }
  }

  updateRoomStatus(roomCode: string, status: string) {
    const row = this.data.find(r => r.room_code === roomCode)
    if (row) { row.status = status; this.save() }
  }

  saveGameState(roomCode: string, gameState: any) {
    const row = this.data.find(r => r.room_code === roomCode)
    if (row) { row.game_state = JSON.stringify(gameState); this.save() }
  }

  addPlayerToRoom(roomCode: string, userName: string, socketId: string) {
    if (!this.roomPlayers.has(roomCode)) this.roomPlayers.set(roomCode, [])
    const players = this.roomPlayers.get(roomCode)!
    const existing = players.find(p => p.userName === userName)
    if (existing) {
      existing.socketId = socketId
      existing.isConnected = true
      return { player: existing, isReconnect: true }
    }
    const player: PlayerData = { userName, socketId, role: null, isAlive: true, isConnected: true }
    players.push(player)
    return { player, isReconnect: false }
  }

  removePlayerFromRoom(roomCode: string, socketId: string) {
    if (!this.roomPlayers.has(roomCode)) return []
    const players = this.roomPlayers.get(roomCode)!
    const p = players.find(x => x.socketId === socketId)
    if (p) p.isConnected = false
    return players
  }

  addSpectator(roomCode: string, userName: string, socketId: string) {
    if (!this.roomSpectators.has(roomCode)) this.roomSpectators.set(roomCode, [])
    const spectators = this.roomSpectators.get(roomCode)!
    if (!spectators.find(s => s.userName === userName)) {
      spectators.push({ userName, socketId })
    }
  }

  removeSpectator(roomCode: string, socketId: string) {
    if (!this.roomSpectators.has(roomCode)) return
    const spectators = this.roomSpectators.get(roomCode)!
    const idx = spectators.findIndex(s => s.socketId === socketId)
    if (idx >= 0) spectators.splice(idx, 1)
  }

  getRoomPlayers(roomCode: string): PlayerData[] {
    return this.roomPlayers.get(roomCode) || []
  }

  getRoomSpectators(roomCode: string): SpectatorData[] {
    return this.roomSpectators.get(roomCode) || []
  }

  saveGameResult(roomCode: string, result: any, participants: any) {
    return 1
  }
}

export const db = new JsonDatabase()
