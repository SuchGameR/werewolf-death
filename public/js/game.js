let roomCode = '';
let userName = '';
let myRole = 'spectator';
let gameState = null;
let selectedNightTarget = null;

function init() {
  roomCode = getParam('code') || sessionStorage.getItem('wwRoomCode');
  userName = getParam('name') || sessionStorage.getItem('wwUserName');

  if (!roomCode || !userName) { location.href = '/lobby'; return; }

  socket.emit('join-room', { roomCode, userName });

  socket.on('role-assign', (data) => {
    myRole = data.role;
    updateRoleDisplay();
  });

  socket.on('game-state', (state) => {
    const prevPhase = gameState ? gameState.phase : null;
    gameState = state;
    if (state.phase === 'ended' && state.winner) {
      sessionStorage.setItem('wwResult', JSON.stringify(state));
      location.href = `/result/${roomCode}?name=${encodeURIComponent(userName)}`;
      return;
    }
    if (prevPhase !== state.phase) selectedNightTarget = null;
    render();
  });

  socket.on('chat-message', (data) => addChatMessage(data.userName, data.message));

  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });
}

function render() {
  if (!gameState) return;
  updateRoleDisplay();
  document.getElementById('phaseDisplay').textContent = phaseLabel(gameState.phase);
  document.getElementById('turnDisplay').textContent = gameState.turn;
  renderPlayerList();
  renderSpectatorList();
  renderActionPanel();
  renderLog();
}

function updateRoleDisplay() {
  const el = document.getElementById('myRoleDisplay');
  el.textContent = roleLabel(myRole);
  el.className = 'value ' + roleClass(myRole);
}

function renderPlayerList() {
  const sidebar = document.getElementById('playerListSidebar');
  const all = [];
  (gameState.wolves || []).forEach(w => all.push({ name: w.name, isAlive: w.isAlive, role: 'wolf', starveDays: w.starveDays, isNailClipped: w.isNailClipped }));
  if (gameState.spy) all.push({ name: gameState.spy.name, isAlive: gameState.spy.isAlive, role: 'spy', starveDays: null });

  sidebar.innerHTML = all.map(p => {
    let extra = '';
    if (p.role === 'wolf' && (myRole === 'wolf' || myRole === 'spy')) {
      const sd = p.starveDays != null ? p.starveDays : 1.5;
      const pct = Math.min(100, Math.max(0, (sd / 3) * 100));
      const danger = sd <= 0.5 ? 'danger' : 'safe';
      extra = `<div class="starve-days ${danger}">飢餓: ${sd.toFixed(1)}日<div class="starve-bar"><div class="starve-bar-fill" style="width:${pct}%"></div></div></div>`;
    }
    if (p.isNailClipped) extra += '<div style="color:var(--spy-color);font-size:0.7rem;">【爪切り済】</div>';
    const statusClass = p.isAlive ? 'alive' : 'dead';
    return `<div class="player-card ${statusClass}"><div><span>${esc(p.name)}</span>${extra}</div><span>${p.isAlive ? '' : '💀'}</span></div>`;
  }).join('');
}

function renderSpectatorList() {
  document.getElementById('spectatorListSidebar').textContent =
    (gameState.spectators || []).length ? (gameState.spectators || []).map(s => s.userName).join(', ') : 'なし';
}

function renderActionPanel() {
  const panel = document.getElementById('actionPanel');
  if (!gameState) return;
  if (gameState.phase === 'ended') { panel.innerHTML = '<div class="waiting-text">ゲーム終了</div>'; return; }
  if (!isPlayerAlive()) { panel.innerHTML = '<div class="waiting-text">あなたは死亡しました。</div>'; return; }
  if (myRole === 'spectator') { panel.innerHTML = '<div class="waiting-text">観戦モードです。</div>'; return; }

  switch (gameState.phase) {
    case 'attack_vote': panel.innerHTML = buildAttackVote(); break;
    case 'night_attack': panel.innerHTML = buildNightAttack(); break;
    case 'report': panel.innerHTML = buildReport(); break;
    case 'starvation_check':
    case 'win_check': panel.innerHTML = '<div class="waiting-text">結果を集計中...</div>'; break;
    default: panel.innerHTML = '<div class="waiting-text">フェーズを待機中...</div>';
  }
}

function buildAttackVote() {
  const isWolf = myRole === 'wolf' || myRole === 'spy';
  const alreadyVoted = gameState.votes.attack[userName] != null;
  let html = '<h2>襲撃決議</h2>';

  if (gameState.skipNextAttack) {
    html += '<div class="phase-result"><div class="result-icon">📡</div><div class="result-text" style="color:var(--accent-blue);">通報の影響で今回の襲撃はスキップされます</div></div>';
    return html;
  }

  html += '<p class="action-description">村への襲撃を行うか投票してください。<br>多数決で決まります。同数は失敗。</p>';

  if (myRole === 'spy') {
    html += '<div class="spy-panel"><h3>スパイ能力</h3><div class="ability-buttons">';
    html += abtn('flare', '📡 信号弾', '襲撃を強制的に失敗', !gameState.spy.flareUsed);
    html += abtn('warning', '⚠️ 警告', '襲撃成功率を低下', !gameState.warningUsedThisTurn);
    html += '</div></div>';
  }

  if (isWolf && !alreadyVoted) {
    html += '<div class="vote-buttons">';
    html += '<button class="btn btn-primary" onclick="voteAttack(\'yes\')">襲撃する</button>';
    html += '<button class="btn btn-secondary" onclick="voteAttack(\'no\')">襲撃しない</button>';
    html += '</div>';
  } else if (isWolf && alreadyVoted) {
    html += '<p style="color:var(--text-secondary);">投票済みです。</p>';
  }

  html += attackResultHtml();
  return html;
}

function attackResultHtml() {
  if (!gameState.lastAttackResult) return '';
  if (gameState.lastAttackResult === 'success') return '<div class="phase-result mt-10"><div class="result-icon">✅</div><div class="result-text result-success">襲撃成功！+0.5日</div></div>';
  if (gameState.lastAttackResult === 'fail') return '<div class="phase-result mt-10"><div class="result-icon">❌</div><div class="result-text result-fail">襲撃失敗…-1日</div></div>';
  if (gameState.lastAttackResult === 'skipped') return '<div class="phase-result mt-10"><div class="result-icon">⏭️</div><div class="result-text">スキップ</div></div>';
  return '';
}

function abtn(action, name, desc, available) {
  if (!available) {
    return `<button class="ability-btn used" disabled><span class="ability-name">${name}</span><span class="ability-desc">${desc}</span><span style="display:block;font-size:0.7rem;color:var(--text-secondary);">(使用済)</span></button>`;
  }
  return `<button class="ability-btn" onclick="useAbility('${action}')"><span class="ability-name">${name}</span><span class="ability-desc">${desc}</span></button>`;
}

function buildNightAttack() {
  const isWolf = myRole === 'wolf' || myRole === 'spy';
  const alreadyVoted = gameState.votes.nightAttack[userName] != null;
  const aliveTargets = getAliveTargets().filter(t => t !== userName);
  let html = '<h2>夜襲</h2>';
  html += '<p class="action-description">怪しい人物を襲撃します。<br>2人以上が同じ対象に投票すると実行。<br>スパイに当たれば即勝利！仲間誤射のリスクも…</p>';

  if (myRole === 'spy') {
    html += '<div class="spy-panel"><h3>スパイ能力</h3><div class="ability-buttons">';
    html += abtn('nailClipper', '💅 爪切り', '対象の人狼を襲撃不可', !gameState.spy.nailClipperUsed);
    html += '</div></div>';
  }

  if (isWolf && !alreadyVoted) {
    const myWolf = gameState.wolves.find(w => w.name === userName);
    const canVote = myRole === 'spy' || (myWolf && !myWolf.isNailClipped);
    if (!canVote) {
      html += '<p style="color:var(--accent-red);">爪切りの影響で襲撃に参加できません。</p>';
    } else {
      html += '<p class="mb-10">襲撃対象:</p><div class="target-select">';
      aliveTargets.forEach(t => { html += `<button class="target-btn" onclick="selectNightTarget('${t}')" id="nt_${t}">${esc(t)}</button>`; });
      html += '</div>';
      html += '<button class="btn btn-primary" onclick="confirmNightAttack()" id="confirmNightBtn" disabled>襲撃する</button> ';
      html += '<button class="btn btn-ghost" onclick="voteNightAttack(\'\')">見送る</button>';
    }
  } else if (alreadyVoted) {
    html += '<p style="color:var(--text-secondary);">投票済みです。</p>';
  }

  if (gameState.nightAttackResult) {
    const m = { spy_killed: '🐺/スパイ排除！', wolf_killed: '💀/同士討ち…', failed: '❌/失敗' };
    const r = m[gameState.nightAttackResult] || '❓';
    const [icon, text] = r.split('/');
    html += `<div class="phase-result"><div class="result-icon">${icon}</div><div class="result-text">${text}</div></div>`;
  }
  return html;
}

function buildReport() {
  const alive = isPlayerAlive();
  const alreadyVoted = gameState.votes.report[userName] != null;
  let html = '<h2>通報決議</h2>';

  if (gameState.reportSkipped || gameState.reportResult === 'skipped') {
    html += '<div class="phase-result"><div class="result-icon">🔥</div><div class="result-text" style="color:var(--accent-red);">放火により通報スキップ</div></div>';
    return html;
  }

  html += '<p class="action-description">村へ通報するか投票（秘密投票）。<br>過半数で通報成功→次回襲撃をスキップ。</p>';

  if (myRole === 'spy') {
    html += '<div class="spy-panel"><h3>スパイ能力</h3><div class="ability-buttons">';
    html += abtn('arson', '🔥 放火', '通報を強制スキップ', !gameState.spy.arsonUsed);
    html += '</div></div>';
  }

  if (alive && !alreadyVoted) {
    html += '<div class="vote-buttons">';
    html += '<button class="btn btn-primary" onclick="voteReport(\'yes\')">通報する</button>';
    html += '<button class="btn btn-secondary" onclick="voteReport(\'no\')">通報しない</button>';
    html += '</div>';
  } else if (alreadyVoted) {
    html += '<p style="color:var(--text-secondary);">投票済み（結果をお待ちください）。</p>';
  }

  const total = getAliveTargets().length;
  const voted = Object.keys(gameState.votes.report).length;
  html += `<p style="font-size:0.8rem;color:var(--text-secondary);margin-top:10px;">${voted}/${total} 投票完了</p>`;

  if (gameState.reportResult && gameState.reportResult !== 'skipped') {
    const icon = gameState.reportResult === 'success' ? '📡' : '❌';
    const text = gameState.reportResult === 'success' ? '通報成功！次回襲撃スキップ' : '通報否決';
    html += `<div class="phase-result"><div class="result-icon">${icon}</div><div class="result-text">${text}</div></div>`;
  }
  return html;
}

function renderLog() {
  const el = document.getElementById('gameLog');
  el.innerHTML = (gameState.log || []).map(l =>
    `<div class="log-entry ${l.type}">[${l.turn > 0 ? l.turn + 'T' : '開始'}] ${esc(l.message)}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

function getAliveTargets() {
  const t = [];
  (gameState.wolves || []).forEach(w => { if (w.isAlive) t.push(w.name); });
  if (gameState.spy && gameState.spy.isAlive) t.push(gameState.spy.name);
  return t;
}

function isPlayerAlive() {
  if (myRole === 'spy') return gameState.spy && gameState.spy.isAlive;
  if (myRole === 'wolf') { const w = gameState.wolves.find(x => x.name === userName); return w && w.isAlive; }
  return false;
}

function voteAttack(vote) { socket.emit('vote-attack', { roomCode, vote }); }

function selectNightTarget(name) {
  selectedNightTarget = name;
  document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById('nt_' + name);
  if (btn) btn.classList.add('selected');
  document.getElementById('confirmNightBtn').disabled = false;
}

function confirmNightAttack() {
  if (!selectedNightTarget) return toast('対象を選んでください');
  voteNightAttack(selectedNightTarget);
}

function voteNightAttack(targetName) { socket.emit('vote-night-attack', { roomCode, targetName }); }
function voteReport(vote) { socket.emit('vote-report', { roomCode, vote }); }

function useAbility(ability) {
  if (ability === 'nailClipper') {
    const wolves = (gameState.wolves || []).filter(w => w.isAlive && !w.isNailClipped);
    if (!wolves.length) return toast('対象となる人狼がいません');
    const target = prompt(`爪切りの対象:\n${wolves.map((w, i) => `${i+1}. ${w.name}`).join('\n')}\n\n名前を入力:`);
    if (!target) return;
    if (!wolves.find(w => w.name === target)) return toast('無効な名前です');
    socket.emit('use-ability', { roomCode, ability, targetName: target });
    return;
  }
  socket.emit('use-ability', { roomCode, ability, targetName: null });
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chat-message', { roomCode, message: msg });
  input.value = '';
}

function addChatMessage(name, msg) {
  const el = document.getElementById('chatMessages');
  el.innerHTML += `<div class="chat-msg"><span class="chat-name">${esc(name)}</span>: ${esc(msg)}</div>`;
  el.scrollTop = el.scrollHeight;
}

document.addEventListener('DOMContentLoaded', init);
