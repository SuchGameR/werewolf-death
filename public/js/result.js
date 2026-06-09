let roomCode = '';
let userName = '';

function init() {
  roomCode = getParam('code') || sessionStorage.getItem('wwRoomCode');
  userName = getParam('name') || sessionStorage.getItem('wwUserName');

  const stored = sessionStorage.getItem('wwResult');
  if (stored) {
    try {
      renderResult(JSON.parse(stored));
    } catch (e) {
      loadFromServer();
    }
  } else {
    loadFromServer();
  }
}

function loadFromServer() {
  fetch(`/api/rooms/${roomCode}`).then(r => r.json()).then(data => {
    if (data.success && data.room.gameState) {
      renderResult(data.room.gameState);
    } else {
      document.querySelector('.page-card').innerHTML = '<div class="waiting-text">結果データが見つかりません</div>';
    }
  }).catch(() => {});
}

function renderResult(state) {
  const wolfWin = state.winner === 'wolf';
  const villageWin = state.winner === 'village';

  const banner = document.getElementById('winnerBanner');
  banner.className = 'result-winner-banner ' + (wolfWin ? 'wolf-win' : villageWin ? 'village-win' : 'no-win');
  if (wolfWin) {
    banner.querySelector('h2').textContent = '🐺 人狼陣営の勝利！';
    banner.querySelector('p').textContent = 'スパイは排除され、人狼たちは生き延びた…';
  } else if (villageWin) {
    banner.querySelector('h2').textContent = '🌿 村人陣営の勝利！';
    banner.querySelector('p').textContent = 'スパイの活躍により、人狼たちは滅びた…';
  } else {
    banner.querySelector('h2').textContent = '引き分け';
    banner.querySelector('p').textContent = '勝敗は決しませんでした';
  }

  const reveal = document.getElementById('roleReveal');
  const all = [];

  (state.wolves || []).forEach(w => {
    all.push({ name: w.name, role: 'wolf', isAlive: w.isAlive, extra: `飢餓: ${(w.starveDays || 0).toFixed(1)}日` });
  });
  if (state.spy) {
    all.push({ name: state.spy.name, role: 'spy', isAlive: state.spy.isAlive, extra: '' });
  }

  reveal.innerHTML = all.map(p => {
    const rc = p.role === 'wolf' ? 'wolf' : 'spy';
    return `<div class="role-card ${rc}">
      <div class="rc-name">${esc(p.name)}</div>
      <div class="rc-role">${roleLabel(p.role)}</div>
      <div class="rc-status ${p.isAlive ? 'alive' : 'dead'}">${p.isAlive ? '生存' : '死亡'}</div>
      ${p.extra ? `<div style="font-size:0.75rem;color:var(--text-secondary);">${p.extra}</div>` : ''}
    </div>`;
  }).join('');
}

function backToLobby() {
  sessionStorage.removeItem('wwResult');
  location.href = '/lobby';
}

document.addEventListener('DOMContentLoaded', init);
