function refreshList() {
  fetch('/api/rooms/list').then(r => r.json()).then(data => {
    const list = document.getElementById('roomList');
    if (!data.success || !data.rooms.length) {
      list.innerHTML = '<p style="color:var(--text-secondary);">利用可能な部屋はありません</p>';
      return;
    }
    list.innerHTML = data.rooms.map(r => `
      <div class="room-item" onclick="joinByCode('${r.roomCode}')">
        <div class="room-item-info">
          <h3>${esc(r.roomName)}</h3>
          <p>${r.creatorName} · ${r.hasPassword ? '🔒 ' : ''}${r.playerCount}人参加中</p>
        </div>
        <div class="room-item-meta">
          <span class="room-status-badge status-${r.status}">${r.status === 'waiting' ? '待機中' : 'プレイ中'}</span>
        </div>
      </div>
    `).join('');
  }).catch(() => {});
}

function showCreateModal() {
  document.getElementById('createModal').style.display = 'flex';
}
function closeCreateModal() {
  document.getElementById('createModal').style.display = 'none';
}

function showJoinModal() {
  document.getElementById('joinModal').style.display = 'flex';
}
function closeJoinModal() {
  document.getElementById('joinModal').style.display = 'none';
}

function createRoom(e) {
  e.preventDefault();
  const name = document.getElementById('creatorName').value.trim();
  const roomName = document.getElementById('roomName').value.trim();
  const password = document.getElementById('roomPassword').value;
  if (!name || !roomName) return toast('名前と部屋名を入力してください');
  fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, password, creatorName: name })
  }).then(r => r.json()).then(data => {
    if (!data.success) return toast(data.error);
    sessionStorage.setItem('wwUserName', name);
    sessionStorage.setItem('wwRoomCode', data.room.roomCode);
    sessionStorage.setItem('wwIsCreator', 'true');
    location.href = `/room/${data.room.roomCode}?name=${encodeURIComponent(name)}`;
  }).catch(() => toast('作成に失敗しました'));
}

function joinByCode(code) {
  const name = prompt('あなたの名前を入力してください:');
  if (!name || !name.trim()) return;
  fetch('/api/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: code, password: '', userName: name.trim() })
  }).then(r => r.json()).then(data => {
    if (!data.success) {
      if (data.error.includes('パスワード')) {
        const pw = prompt('パスワードを入力してください:');
        if (!pw) return;
        return fetch('/api/rooms/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: code, password: pw, userName: name.trim() })
        }).then(r2 => r2.json()).then(d2 => {
          if (!d2.success) return toast(d2.error);
          sessionStorage.setItem('wwUserName', name.trim());
          sessionStorage.setItem('wwRoomCode', code);
          location.href = `/room/${code}?name=${encodeURIComponent(name.trim())}`;
        });
      }
      return toast(data.error);
    }
    if (data.room.password) {
      const pw = prompt('パスワードを入力してください:');
      if (!pw) return;
      return fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, password: pw, userName: name.trim() })
      }).then(r2 => r2.json()).then(d2 => {
        if (!d2.success) return toast(d2.error);
        sessionStorage.setItem('wwUserName', name.trim());
        sessionStorage.setItem('wwRoomCode', code);
        location.href = `/room/${code}?name=${encodeURIComponent(name.trim())}`;
      });
    }
    sessionStorage.setItem('wwUserName', name.trim());
    sessionStorage.setItem('wwRoomCode', code);
    location.href = `/room/${code}?name=${encodeURIComponent(name.trim())}`;
  }).catch(() => toast('参加に失敗しました'));
}

function joinRoom(e) {
  e.preventDefault();
  const name = document.getElementById('joinUserName').value.trim();
  const code = document.getElementById('joinRoomCode').value.trim().toUpperCase();
  const password = document.getElementById('joinPassword').value;
  if (!name || !code) return toast('名前と部屋コードを入力してください');
  fetch('/api/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: code, password, userName: name })
  }).then(r => r.json()).then(data => {
    if (!data.success) return toast(data.error);
    sessionStorage.setItem('wwUserName', name);
    sessionStorage.setItem('wwRoomCode', code);
    location.href = `/room/${code}?name=${encodeURIComponent(name)}`;
  }).catch(() => toast('参加に失敗しました'));
}

document.addEventListener('DOMContentLoaded', () => {
  refreshList();
  ['createModal', 'joinModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) {
        if (id === 'createModal') closeCreateModal();
        else closeJoinModal();
      }
    });
  });
});
