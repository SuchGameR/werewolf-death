const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const Database = require('./database');
const GameEngine = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const db = new Database();
const gameEngine = new GameEngine();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/lobby', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lobby.html')));
app.get('/room/:roomCode', (req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));
app.get('/game/:roomCode', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));
app.get('/result/:roomCode', (req, res) => res.sendFile(path.join(__dirname, 'public', 'result.html')));

app.post('/api/rooms/create', async (req, res) => {
  const { roomName, password, creatorName } = req.body;
  try {
    const room = await db.createRoom(roomName, password, creatorName);
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rooms/join', async (req, res) => {
  const { roomCode, password, userName } = req.body;
  try {
    const room = await db.getRoom(roomCode);
    if (!room) return res.status(404).json({ success: false, error: '部屋が見つかりません' });
    if (room.password && room.password !== password)
      return res.status(403).json({ success: false, error: 'パスワードが違います' });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/rooms/list', async (req, res) => {
  try {
    const rooms = await db.getAllRooms();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/rooms/:roomCode', async (req, res) => {
  try {
    const room = await db.getRoom(req.params.roomCode);
    if (!room) return res.status(404).json({ success: false, error: '部屋が見つかりません' });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomCode, userName }) => {
    const room = await db.getRoom(roomCode);
    if (!room) return socket.emit('error-msg', '部屋が見つかりません');

    let isSpectator = false;
    let isReconnect = false;

    if (room.status === 'playing') {
      const players = db.getRoomPlayers(roomCode);
      const existing = players.find(p => p.userName === userName);
      if (existing) {
        isReconnect = true;
        const result = db.addPlayerToRoom(roomCode, userName, socket.id);
        socket.join(roomCode);
        socket.emit('role-assign', { role: existing.role });
        io.to(roomCode).emit('room-update', {
          players: db.getRoomPlayers(roomCode),
          spectators: db.getRoomSpectators(roomCode),
          roomStatus: room.status
        });
        const gs = gameEngine.getState(roomCode);
        if (gs) socket.emit('game-state', gs);
        return;
      }
      isSpectator = true;
      db.addSpectator(roomCode, userName, socket.id);
      socket.join(roomCode);
      socket.emit('role-assign', { role: 'spectator' });
      io.to(roomCode).emit('room-update', {
        players: db.getRoomPlayers(roomCode),
        spectators: db.getRoomSpectators(roomCode),
        roomStatus: room.status
      });
      const gs = gameEngine.getState(roomCode);
      if (gs) socket.emit('game-state', gs);
      return;
    }

    const result = db.addPlayerToRoom(roomCode, userName, socket.id);
    isReconnect = result.isReconnect;
    socket.join(roomCode);
    io.to(roomCode).emit('room-update', {
      players: db.getRoomPlayers(roomCode),
      spectators: db.getRoomSpectators(roomCode),
      roomStatus: room.status
    });
  });

  socket.on('leave-room', async ({ roomCode }) => {
    db.removePlayerFromRoom(roomCode, socket.id);
    db.removeSpectator(roomCode, socket.id);
    socket.leave(roomCode);
    io.to(roomCode).emit('room-update', {
      players: db.getRoomPlayers(roomCode),
      spectators: db.getRoomSpectators(roomCode)
    });
  });

  socket.on('update-settings', async ({ roomCode, settings }) => {
    await db.updateRoomSettings(roomCode, settings);
    io.to(roomCode).emit('settings-updated', settings);
  });

  socket.on('start-game', async ({ roomCode }) => {
    const room = await db.getRoom(roomCode);
    if (!room) return;
    const players = db.getRoomPlayers(roomCode);
    const connectedPlayers = players.filter(p => p.isConnected);
    if (connectedPlayers.length < 3) {
      io.to(roomCode).emit('error-msg', '3人以上必要です');
      return;
    }
    const settings = room.settings;
    try {
      const gs = gameEngine.initGame(roomCode, connectedPlayers, settings);
      gameEngine.beginAttackPhase(roomCode);
      await db.updateRoomStatus(roomCode, 'playing');
      await db.saveGameState(roomCode, gs);
      connectedPlayers.forEach(p => {
        const role = gs.playerRoles[p.userName];
        io.to(p.socketId).emit('role-assign', { role });
      });
      io.to(roomCode).emit('game-state', gs);
      io.to(roomCode).emit('room-update', {
        players: db.getRoomPlayers(roomCode),
        spectators: db.getRoomSpectators(roomCode),
        roomStatus: 'playing'
      });
    } catch (err) {
      io.to(roomCode).emit('error-msg', err.message);
    }
  });

  socket.on('vote-attack', async ({ roomCode, vote }) => {
    const players = db.getRoomPlayers(roomCode);
    const p = players.find(x => x.socketId === socket.id);
    if (!p) return;
    const result = gameEngine.handleVoteAttack(roomCode, p.userName, vote);
    if (result.error) return socket.emit('error-msg', result.error);
    const gs = gameEngine.getState(roomCode);
    await db.saveGameState(roomCode, gs);
    io.to(roomCode).emit('game-state', gs);
  });

  socket.on('vote-night-attack', async ({ roomCode, targetName }) => {
    const players = db.getRoomPlayers(roomCode);
    const p = players.find(x => x.socketId === socket.id);
    if (!p) return;
    const result = gameEngine.handleVoteNightAttack(roomCode, p.userName, targetName);
    if (result.error) return socket.emit('error-msg', result.error);
    const gs = gameEngine.getState(roomCode);
    await db.saveGameState(roomCode, gs);
    io.to(roomCode).emit('game-state', gs);
  });

  socket.on('vote-report', async ({ roomCode, vote }) => {
    const players = db.getRoomPlayers(roomCode);
    const p = players.find(x => x.socketId === socket.id);
    if (!p) return;
    const result = gameEngine.handleVoteReport(roomCode, p.userName, vote);
    if (result.error) return socket.emit('error-msg', result.error);
    const gs = gameEngine.getState(roomCode);
    await db.saveGameState(roomCode, gs);
    io.to(roomCode).emit('game-state', gs);
  });

  socket.on('use-ability', async ({ roomCode, ability, targetName }) => {
    const players = db.getRoomPlayers(roomCode);
    const p = players.find(x => x.socketId === socket.id);
    if (!p) return;
    const result = gameEngine.handleSpyAbility(roomCode, p.userName, ability, targetName);
    if (result.error) return socket.emit('error-msg', result.error);
    const gs = gameEngine.getState(roomCode);
    await db.saveGameState(roomCode, gs);
    io.to(roomCode).emit('game-state', gs);
  });

  socket.on('chat-message', async ({ roomCode, message }) => {
    const players = db.getRoomPlayers(roomCode);
    const p = players.find(x => x.socketId === socket.id);
    if (!p) return;
    io.to(roomCode).emit('chat-message', { userName: p.userName, message, timestamp: Date.now() });
  });

  socket.on('disconnect', () => {
    db.roomPlayers.forEach((players, roomCode) => {
      const idx = players.findIndex(p => p.socketId === socket.id);
      if (idx >= 0) {
        players[idx].isConnected = false;
        io.to(roomCode).emit('room-update', {
          players: db.getRoomPlayers(roomCode),
          spectators: db.getRoomSpectators(roomCode)
        });
      }
    });
    db.roomSpectators.forEach((spectators, roomCode) => {
      const idx = spectators.findIndex(s => s.socketId === socket.id);
      if (idx >= 0) spectators.splice(idx, 1);
    });
  });
});

db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`=== Werewolf Death Server ===`);
    console.log(`http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('DB init error:', err);
});
