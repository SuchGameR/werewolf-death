const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'werewolf.db');
    this.db = null;
    this.roomPlayers = new Map();
    this.roomSpectators = new Map();
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);
        this.db.serialize(() => {
          this.db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code TEXT UNIQUE NOT NULL,
            room_name TEXT NOT NULL,
            password TEXT,
            creator_name TEXT NOT NULL,
            status TEXT DEFAULT 'waiting',
            settings TEXT,
            game_state TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`);
          this.db.run(`CREATE TABLE IF NOT EXISTS game_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code TEXT NOT NULL,
            result TEXT,
            participants TEXT,
            ended_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err2) => {
            if (err2) reject(err2);
            else resolve();
          });
        });
      });
    });
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom(roomName, password, creatorName) {
    return new Promise((resolve, reject) => {
      const roomCode = this.generateRoomCode();
      const settings = JSON.stringify({ wolfCount: 3, maxPlayers: 8 });
      this.db.run(
        'INSERT INTO rooms (room_code, room_name, password, creator_name, settings) VALUES (?, ?, ?, ?, ?)',
        [roomCode, roomName, password || null, creatorName, settings],
        function(err) {
          if (err) reject(err);
          else resolve({
            id: this.lastID, roomCode, roomName,
            hasPassword: !!password, creatorName, status: 'waiting'
          });
        }
      );
    });
  }

  getRoom(roomCode) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM rooms WHERE room_code = ?', [roomCode], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve({
          id: row.id, roomCode: row.room_code, roomName: row.room_name,
          password: row.password, creatorName: row.creator_name,
          status: row.status, settings: JSON.parse(row.settings || '{}'),
          gameState: row.game_state ? JSON.parse(row.game_state) : null,
          createdAt: row.created_at
        });
      });
    });
  }

  getAllRooms() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT room_code, room_name, password, creator_name, status, created_at FROM rooms WHERE status != 'finished' ORDER BY created_at DESC", (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          roomCode: row.room_code, roomName: row.room_name,
          hasPassword: !!row.password, creatorName: row.creator_name,
          status: row.status, createdAt: row.created_at,
          playerCount: this.roomPlayers.get(row.room_code)?.length || 0
        })));
      });
    });
  }

  updateRoomSettings(roomCode, settings) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE rooms SET settings = ? WHERE room_code = ?', [JSON.stringify(settings), roomCode], (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  updateRoomStatus(roomCode, status) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE rooms SET status = ? WHERE room_code = ?', [status, roomCode], (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  saveGameState(roomCode, gameState) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE rooms SET game_state = ? WHERE room_code = ?', [JSON.stringify(gameState), roomCode], (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  addPlayerToRoom(roomCode, userName, socketId) {
    if (!this.roomPlayers.has(roomCode)) this.roomPlayers.set(roomCode, []);
    const players = this.roomPlayers.get(roomCode);
    const existing = players.find(p => p.userName === userName);
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
    const p = players.find(x => x.socketId === socketId);
    if (p) p.isConnected = false;
    return players;
  }

  addSpectator(roomCode, userName, socketId) {
    if (!this.roomSpectators.has(roomCode)) this.roomSpectators.set(roomCode, []);
    const spectators = this.roomSpectators.get(roomCode);
    if (!spectators.find(s => s.userName === userName)) {
      spectators.push({ userName, socketId });
    }
  }

  removeSpectator(roomCode, socketId) {
    if (!this.roomSpectators.has(roomCode)) return;
    const spectators = this.roomSpectators.get(roomCode);
    const idx = spectators.findIndex(s => s.socketId === socketId);
    if (idx >= 0) spectators.splice(idx, 1);
  }

  getRoomPlayers(roomCode) { return this.roomPlayers.get(roomCode) || []; }
  getRoomSpectators(roomCode) { return this.roomSpectators.get(roomCode) || []; }

  saveGameResult(roomCode, result, participants) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO game_logs (room_code, result, participants) VALUES (?, ?, ?)',
        [roomCode, JSON.stringify(result), JSON.stringify(participants)],
        function(err) { if (err) reject(err); else resolve(this.lastID); }
      );
    });
  }
}

module.exports = Database;
