import fs from 'fs';
import path from 'path';

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class JsonDatabase {
  constructor() {
    __publicField(this, "dbPath");
    __publicField(this, "data", []);
    __publicField(this, "nextId", 1);
    __publicField(this, "roomPlayers", /* @__PURE__ */ new Map());
    __publicField(this, "roomSpectators", /* @__PURE__ */ new Map());
    this.dbPath = path.join(process.cwd(), "werewolf.json");
  }
  init() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, "utf-8");
        this.data = JSON.parse(raw);
        this.nextId = this.data.reduce((max, r) => Math.max(max, r.id), 0) + 1;
      } catch {
        this.data = [];
      }
    }
  }
  save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), "utf-8");
  }
  generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  createRoom(roomName, password, creatorName) {
    const roomCode = this.generateRoomCode();
    const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
    const row = {
      id: this.nextId++,
      room_code: roomCode,
      room_name: roomName,
      password: password || null,
      creator_name: creatorName,
      status: "waiting",
      settings: JSON.stringify({ wolfCount: 3, maxPlayers: 8 }),
      game_state: null,
      created_at: now
    };
    this.data.push(row);
    this.save();
    return {
      id: row.id,
      roomCode,
      roomName,
      hasPassword: !!password,
      creatorName,
      status: "waiting"
    };
  }
  getRoom(roomCode) {
    const row = this.data.find((r) => r.room_code === roomCode);
    if (!row) return null;
    return {
      id: row.id,
      roomCode: row.room_code,
      roomName: row.room_name,
      password: row.password,
      creatorName: row.creator_name,
      status: row.status,
      settings: JSON.parse(row.settings || "{}"),
      gameState: row.game_state ? JSON.parse(row.game_state) : null,
      createdAt: row.created_at
    };
  }
  getAllRooms() {
    const active = this.data.filter((r) => r.status !== "finished");
    active.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return active.map((row) => {
      var _a;
      return {
        roomCode: row.room_code,
        roomName: row.room_name,
        hasPassword: !!row.password,
        creatorName: row.creator_name,
        status: row.status,
        createdAt: row.created_at,
        playerCount: ((_a = this.roomPlayers.get(row.room_code)) == null ? void 0 : _a.length) || 0
      };
    });
  }
  updateRoomSettings(roomCode, settings) {
    const row = this.data.find((r) => r.room_code === roomCode);
    if (row) {
      row.settings = JSON.stringify(settings);
      this.save();
    }
  }
  updateRoomStatus(roomCode, status) {
    const row = this.data.find((r) => r.room_code === roomCode);
    if (row) {
      row.status = status;
      this.save();
    }
  }
  saveGameState(roomCode, gameState) {
    const row = this.data.find((r) => r.room_code === roomCode);
    if (row) {
      row.game_state = JSON.stringify(gameState);
      this.save();
    }
  }
  addPlayerToRoom(roomCode, userName, socketId) {
    if (!this.roomPlayers.has(roomCode)) this.roomPlayers.set(roomCode, []);
    const players = this.roomPlayers.get(roomCode);
    const existing = players.find((p) => p.userName === userName);
    if (existing) {
      existing.socketId = socketId;
      existing.isConnected = true;
      return { player: existing, isReconnect: true };
    }
    const player = { userName, socketId, role: null, isAlive: true, isConnected: true };
    players.push(player);
    return { player, isReconnect: false };
  }
  removePlayerFromRoom(roomCode, socketId) {
    if (!this.roomPlayers.has(roomCode)) return [];
    const players = this.roomPlayers.get(roomCode);
    const p = players.find((x) => x.socketId === socketId);
    if (p) p.isConnected = false;
    return players;
  }
  addSpectator(roomCode, userName, socketId) {
    if (!this.roomSpectators.has(roomCode)) this.roomSpectators.set(roomCode, []);
    const spectators = this.roomSpectators.get(roomCode);
    if (!spectators.find((s) => s.userName === userName)) {
      spectators.push({ userName, socketId });
    }
  }
  removeSpectator(roomCode, socketId) {
    if (!this.roomSpectators.has(roomCode)) return;
    const spectators = this.roomSpectators.get(roomCode);
    const idx = spectators.findIndex((s) => s.socketId === socketId);
    if (idx >= 0) spectators.splice(idx, 1);
  }
  getRoomPlayers(roomCode) {
    return this.roomPlayers.get(roomCode) || [];
  }
  getRoomSpectators(roomCode) {
    return this.roomSpectators.get(roomCode) || [];
  }
  saveGameResult(roomCode, result, participants) {
    return 1;
  }
}
const db = new JsonDatabase();

export { db as d };
//# sourceMappingURL=database.mjs.map
