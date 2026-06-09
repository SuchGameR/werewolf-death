let roomCode = '';
let userName = '';
let isCreator = false;
let roomStatus = 'waiting';

function init() {
  roomCode = getParam('code') || sessionStorage.getItem('wwRoomCode');
  userName = getParam('name') || sessionStorage.getItem('wwUserName');
  isCreator = sessionStorage.getItem('wwIsCreator') === 'true';

  if (!roomCode || !userName) {
    location.href = '/lobby';
    return;
  }

  document.getElementById('roomCodeDisplay').textContent = roomCode;

  fetch(`/api/rooms/${roomCode}`).then(r => r.json()).then(data => {
    if (!data.success) { location.href = '/lobby'; return; }
    document.getElementById('roomNameDisplay').textContent = data.room.roomName;
    roomStatus = data.room.status;
    if (data.room.status === 'playing') {
      location.href = `/game/${roomCode}?name=${encodeURIComponent(userName)}`;
      return;
    }
    if (data.room.status === 'finished') {
      location.href = `/result/${roomCode}`;
      return;
    }
    const s = data.room.settings;
    if (s.wolfCount) document.getElementById('wolfCount').value = s.wolfCount;
    if (s.maxPlayers) document.getElementById('maxPlayers').value = s.maxPlayers;
  });

  socket.emit('join-room', { roomCode, userName });

  socket.on('room-update', (data) => {
    renderPlayers(data.players, data.spectators || []);
    roomStatus = data.roomStatus || roomStatus;
    if (roomStatus === 'playing') {
      location.href = `/game/${roomCode}?name=${encodeURIComponent(userName)}`;
    }
  });

  socket.on('settings-updated', (settings) => {
    if (settings.wolfCount) document.getElementById('wolfCount').value = settings.wolfCount;
    if (settings.maxPlayers) document.getElementById('maxPlayers').value = settings.maxPlayers;
    toast('設定を保存しました', false);
  });

  socket.on('game-state', () => {
    location.href = `/game/${roomCode}?name=${encodeURIComponent(userName)}`;
  });
}

function renderPlayers(players, spectators) {
  const list = document.getElementById('playersList');
  const count = document.getElementById('playerCount');
  const connected = players.filter(p => p.isConnected);
  count.textContent = connected.length;
  list.innerHTML = connected.map(p => `
    <div class="player-entry">
      <span class="player-name">${esc(p.userName)}${p.userName === userName ? ' (あなた)' : ''}</span>
      <span class="player-status">準備完了</span>
    </div>
  `).join('');

  document.getElementById('startBtn').disabled = connected.length < 3;

  const specDiv = document.getElementById('spectatorSection');
  const specList = document.getElementById('spectatorList');
  if (spectators && spectators.length) {
    specDiv.style.display = 'block';
    specList.innerHTML = spectators.map(s => `<div class="player-entry"><span class="player-name">${esc(s.userName)}</span><span class="player-status disconnected">観戦</span></div>`).join('');
  } else {
    specDiv.style.display = 'none';
  }
}

function saveSettings() {
  const settings = {
    wolfCount: parseInt(document.getElementById('wolfCount').value),
    maxPlayers: parseInt(document.getElementById('maxPlayers').value)
  };
  socket.emit('update-settings', { roomCode, settings });
}

function startGame() {
  if (roomStatus !== 'waiting') return;
  socket.emit('start-game', { roomCode });
}

function leaveRoom() {
  sessionStorage.removeItem('wwRoomCode');
  socket.emit('leave-room', { roomCode });
  location.href = '/lobby';
}

function copyCode() {
  navigator.clipboard.writeText(roomCode).then(() => toast('コピーしました', false)).catch(() => {});
}

window.addEventListener('beforeunload', () => {
  socket.emit('leave-room', { roomCode });
});

document.addEventListener('DOMContentLoaded', init);
