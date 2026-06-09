const socket = io();

function toast(msg, isError = true) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  if (!isError) el.style.background = 'var(--accent-green)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function getParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function roleClass(role) {
  if (role === 'wolf') return 'role-name-wolf';
  if (role === 'spy') return 'role-name-spy';
  if (role === 'villager') return 'role-name-villager';
  return 'role-name-spectator';
}

function roleLabel(role) {
  const labels = { wolf: '人狼', spy: 'スパイ', villager: '村人', spectator: '観戦' };
  return labels[role] || role;
}

function phaseLabel(phase) {
  const labels = {
    attack_vote: '襲撃決議',
    night_attack: '夜襲',
    report: '通報決議',
    starvation_check: '飢餓チェック',
    win_check: '勝敗判定',
    ended: '終了'
  };
  return labels[phase] || phase;
}

socket.on('error-msg', (msg) => toast(msg));
