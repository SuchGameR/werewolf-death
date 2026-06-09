class GameEngine {
  constructor() {
    this.games = new Map();
  }

  initGame(roomCode, players, settings) {
    const wolfCount = settings.wolfCount || 3;
    if (players.length < 3) {
      throw new Error('プレイヤーは3人以上必要です');
    }
    if (wolfCount >= players.length) {
      throw new Error('人狼の数が多すぎます');
    }

    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const spy = shuffled[0];
    const wolves = shuffled.slice(1);

    const state = {
      phase: 'attack_vote',
      turn: 1,
      wolves: wolves.map(w => ({
        name: w.userName,
        starveDays: 1.5,
        isAlive: true,
        isNailClipped: false
      })),
      spy: {
        name: spy.userName,
        isAlive: true,
        nailClipperUsed: false,
        arsonUsed: false,
        flareUsed: false
      },
      votes: { attack: {}, nightAttack: {}, report: {} },
      attackBlocked: false,
      reportSkipped: false,
      warningUsedThisTurn: false,
      lastAttackResult: null,
      nightAttackResult: null,
      reportResult: null,
      winner: null,
      log: [],
      skipNextAttack: false,
      playerRoles: {}
    };

    players.forEach(p => {
      state.playerRoles[p.userName] = p.userName === spy.userName ? 'spy' : 'wolf';
    });

    state.log.push({ turn: 0, type: 'system', message: 'ゲーム開始！役職が割り振られました。' });
    state.log.push({ turn: 0, type: 'system', message: `人狼: ${wolves.map(w => w.userName).join(', ')}` });
    state.log.push({ turn: 0, type: 'system', message: `スパイ: ${spy.userName}` });

    this.games.set(roomCode, state);
    return state;
  }

  getState(roomCode) {
    return this.games.get(roomCode) || null;
  }

  addLog(roomCode, entry) {
    const state = this.games.get(roomCode);
    if (state) state.log.push({ turn: state.turn, ...entry });
  }

  resetVotes(state) {
    state.votes = { attack: {}, nightAttack: {}, report: {} };
    state.warningUsedThisTurn = false;
  }

  getAliveWolves(state) {
    return state.wolves.filter(w => w.isAlive);
  }

  getAliveNames(state) {
    const s = new Set();
    state.wolves.filter(w => w.isAlive).forEach(w => s.add(w.name));
    if (state.spy.isAlive) s.add(state.spy.name);
    return s;
  }

  canAct(state, userName) {
    if (state.winner) return false;
    if (state.spy.name === userName) return state.spy.isAlive;
    const wolf = state.wolves.find(w => w.name === userName);
    return wolf ? wolf.isAlive : false;
  }

  // === ATTACK VOTE ===

  beginAttackPhase(roomCode) {
    const state = this.games.get(roomCode);
    if (!state) return;
    this.resetVotes(state);

    if (state.skipNextAttack) {
      state.skipNextAttack = false;
      state.lastAttackResult = 'skipped';
      this.addLog(roomCode, { type: 'system', message: '通報の影響により襲撃はスキップされました。' });
      this.transitionFrom(roomCode, 'attack_vote');
      return;
    }

    state.phase = 'attack_vote';
    this.addLog(roomCode, { type: 'phase', message: `=== ${state.turn}ターン目: 襲撃決議 ===` });
  }

  handleVoteAttack(roomCode, userName, vote) {
    const state = this.games.get(roomCode);
    if (!state || state.phase !== 'attack_vote') return { error: '現在この操作はできません' };
    if (!['yes', 'no'].includes(vote)) return { error: '無効な投票です' };
    if (!this.canAct(state, userName)) return { error: '行動できません' };
    if (state.votes.attack[userName] != null) return { error: '既に投票済みです' };

    state.votes.attack[userName] = vote;
    const aliveWolves = this.getAliveWolves(state);
    if (Object.keys(state.votes.attack).length >= aliveWolves.length) {
      this.resolveAttackVote(roomCode);
    }
    return { success: true };
  }

  resolveAttackVote(roomCode) {
    const state = this.games.get(roomCode);
    const votes = state.votes.attack;
    let yes = 0, no = 0;
    Object.values(votes).forEach(v => { if (v === 'yes') yes++; else no++; });

    let success = yes > no;
    if (state.warningUsedThisTurn) {
      success = yes === this.getAliveWolves(state).length;
    }
    if (state.attackBlocked) {
      success = false;
      state.attackBlocked = false;
    }

    if (success) {
      state.wolves.forEach(w => { if (w.isAlive) w.starveDays += 0.5; });
      state.lastAttackResult = 'success';
      this.addLog(roomCode, { type: 'attack', message: `村の襲撃に成功！全人狼の飢餓日数+0.5` });
    } else {
      state.wolves.forEach(w => { if (w.isAlive) w.starveDays -= 1; });
      state.lastAttackResult = 'fail';
      this.addLog(roomCode, { type: 'attack', message: `村の襲撃に失敗！全人狼の飢餓日数-1` });
    }
    this.transitionFrom(roomCode, 'attack_vote');
  }

  // === NIGHT ATTACK ===

  handleVoteNightAttack(roomCode, userName, targetName) {
    const state = this.games.get(roomCode);
    if (!state || state.phase !== 'night_attack') return { error: '現在この操作はできません' };
    if (!this.canAct(state, userName)) return { error: '行動できません' };
    if (state.votes.nightAttack[userName] != null) return { error: '既に投票済みです' };

    const alive = this.getAliveNames(state);
    if (targetName && !alive.has(targetName)) return { error: '無効な対象です' };
    if (targetName === userName) return { error: '自分を襲撃できません' };

    const wolf = state.wolves.find(w => w.name === userName);
    if (wolf && wolf.isNailClipped) {
      return { error: '爪切りの影響で襲撃できません' };
    }

    state.votes.nightAttack[userName] = targetName || '';
    const aliveWolves = this.getAliveWolves(state);
    if (Object.keys(state.votes.nightAttack).length >= aliveWolves.length) {
      this.resolveNightAttack(roomCode);
    }
    return { success: true };
  }

  resolveNightAttack(roomCode) {
    const state = this.games.get(roomCode);
    const votes = state.votes.nightAttack;
    const targetVotes = {};
    Object.values(votes).forEach(target => {
      if (target) targetVotes[target] = (targetVotes[target] || 0) + 1;
    });

    let maxVotes = 0;
    let chosenTarget = null;
    for (const [target, count] of Object.entries(targetVotes)) {
      if (count > maxVotes) { maxVotes = count; chosenTarget = target; }
    }

    if (maxVotes >= 2 && chosenTarget) {
      if (state.spy.name === chosenTarget && state.spy.isAlive) {
        state.spy.isAlive = false;
        state.winner = 'wolf';
        state.nightAttackResult = 'spy_killed';
        state.phase = 'ended';
        this.addLog(roomCode, { type: 'night_attack', message: `夜襲成功！スパイ(${chosenTarget})を発見・排除。人狼陣営の勝利！` });
        return;
      }
      const targetWolf = state.wolves.find(w => w.name === chosenTarget);
      if (targetWolf && targetWolf.isAlive) {
        targetWolf.isAlive = false;
        state.nightAttackResult = 'wolf_killed';
        this.addLog(roomCode, { type: 'night_attack', message: `夜襲失敗… ${chosenTarget}は人狼でした。同士討ち発生。` });
      } else {
        state.nightAttackResult = 'failed';
        this.addLog(roomCode, { type: 'night_attack', message: `夜襲は失敗に終わりました…` });
      }
    } else {
      state.nightAttackResult = 'failed';
      this.addLog(roomCode, { type: 'night_attack', message: `夜襲の合意が得られませんでした。` });
    }

    this.transitionFrom(roomCode, 'night_attack');
  }

  // === REPORT VOTE ===

  handleVoteReport(roomCode, userName, vote) {
    const state = this.games.get(roomCode);
    if (!state || state.phase !== 'report') return { error: '現在この操作はできません' };
    if (!['yes', 'no'].includes(vote)) return { error: '無効な投票です' };
    if (state.votes.report[userName] != null) return { error: '既に投票済みです' };

    const alive = this.getAliveNames(state);
    if (!alive.has(userName)) return { error: '行動できません' };

    state.votes.report[userName] = vote;
    if (Object.keys(state.votes.report).length >= alive.size) {
      this.resolveReportVote(roomCode);
    }
    return { success: true };
  }

  resolveReportVote(roomCode) {
    const state = this.games.get(roomCode);
    if (state.reportSkipped) {
      state.reportSkipped = false;
      state.reportResult = 'skipped';
      this.addLog(roomCode, { type: 'report', message: '放火により通報フェーズをスキップ。' });
      this.transitionFrom(roomCode, 'report');
      return;
    }

    const votes = state.votes.report;
    let yes = 0, no = 0;
    Object.values(votes).forEach(v => { if (v === 'yes') yes++; else no++; });

    if (yes > no) {
      state.reportResult = 'success';
      state.skipNextAttack = true;
      this.addLog(roomCode, { type: 'report', message: '通報成功！次回の襲撃をスキップ。' });
    } else {
      state.reportResult = 'fail';
      this.addLog(roomCode, { type: 'report', message: '通報は否決されました。' });
    }
    this.transitionFrom(roomCode, 'report');
  }

  // === SPY ABILITIES ===

  handleSpyAbility(roomCode, userName, ability, targetName) {
    const state = this.games.get(roomCode);
    if (!state) return { error: 'ゲームが見つかりません' };
    if (state.spy.name !== userName || !state.spy.isAlive) return { error: 'スパイのみ使用可能です' };

    switch (ability) {
      case 'nailClipper': {
        if (state.spy.nailClipperUsed) return { error: '爪切りは使用済みです' };
        if (!targetName) return { error: '対象を指定してください' };
        if (state.phase !== 'night_attack') return { error: '夜襲フェーズでのみ使用可能です' };
        const target = state.wolves.find(w => w.name === targetName && w.isAlive);
        if (!target) return { error: '無効な対象です' };
        target.isNailClipped = true;
        state.spy.nailClipperUsed = true;
        this.addLog(roomCode, { type: 'spy', message: `スパイが爪切りを使用！${targetName}は襲撃不可に。` });
        return { success: true };
      }
      case 'arson': {
        if (state.spy.arsonUsed) return { error: '放火は使用済みです' };
        if (state.phase !== 'report') return { error: '通報フェーズでのみ使用可能です' };
        state.reportSkipped = true;
        state.spy.arsonUsed = true;
        this.addLog(roomCode, { type: 'spy', message: 'スパイが放火を使用！通報フェーズをスキップ。' });
        this.resolveReportVote(roomCode);
        return { success: true };
      }
      case 'flare': {
        if (state.spy.flareUsed) return { error: '信号弾は使用済みです' };
        if (state.phase !== 'attack_vote') return { error: '襲撃フェーズでのみ使用可能です' };
        state.attackBlocked = true;
        state.spy.flareUsed = true;
        this.addLog(roomCode, { type: 'spy', message: 'スパイが信号弾を使用！襲撃を阻止。' });
        return { success: true };
      }
      case 'warning': {
        if (state.phase !== 'attack_vote') return { error: '襲撃フェーズでのみ使用可能です' };
        state.warningUsedThisTurn = true;
        this.addLog(roomCode, { type: 'spy', message: 'スパイが警告を送信！襲撃成功率低下。' });
        return { success: true };
      }
      default:
        return { error: '不明な能力です' };
    }
  }

  // === PHASE TRANSITIONS ===

  transitionFrom(roomCode, fromPhase) {
    const state = this.games.get(roomCode);
    if (!state || state.winner || state.phase === 'ended') return;

    if (fromPhase === 'attack_vote') {
      this.resetVotes(state);
      if (state.turn === 1) {
        state.phase = 'report';
        this.addLog(roomCode, { type: 'phase', message: `=== 通報決議 ===` });
      } else {
        state.phase = 'night_attack';
        this.addLog(roomCode, { type: 'phase', message: `=== 夜襲 ===` });
      }
      return;
    }

    if (fromPhase === 'night_attack') {
      this.resetVotes(state);
      state.phase = 'report';
      this.addLog(roomCode, { type: 'phase', message: `=== 通報決議 ===` });
      return;
    }

    if (fromPhase === 'report') {
      this.resetVotes(state);
      this.checkStarvation(roomCode);
      return;
    }
  }

  checkStarvation(roomCode) {
    const state = this.games.get(roomCode);
    if (!state || state.winner) return;
    state.phase = 'starvation_check';

    state.wolves.forEach(w => {
      if (!w.isAlive) return;
      if (w.starveDays <= 0) {
        w.isAlive = false;
        this.addLog(roomCode, { type: 'starvation', message: `${w.name}が餓死しました…` });
      }
    });

    this.checkWinCondition(roomCode);
  }

  checkWinCondition(roomCode) {
    const state = this.games.get(roomCode);
    if (!state) return;
    state.phase = 'win_check';

    if (state.winner) { state.phase = 'ended'; return; }

    const aliveWolves = state.wolves.filter(w => w.isAlive);

    if (!state.spy.isAlive) {
      state.winner = 'wolf';
      this.addLog(roomCode, { type: 'win', message: '人狼陣営の勝利！（スパイ死亡）' });
      state.phase = 'ended';
      return;
    }

    if (aliveWolves.length <= 1) {
      state.winner = 'village';
      this.addLog(roomCode, { type: 'win', message: '村人陣営の勝利！（人狼壊滅）' });
      state.phase = 'ended';
      return;
    }

    if (aliveWolves.every(w => w.starveDays >= 2.5)) {
      state.winner = 'wolf';
      this.addLog(roomCode, { type: 'win', message: '人狼陣営の勝利！（豊穣条件達成）' });
      state.phase = 'ended';
      return;
    }

    // Next turn
    state.turn++;
    this.resetVotes(state);
    this.beginAttackPhase(roomCode);
  }

  forceEnd(roomCode) {
    const state = this.games.get(roomCode);
    if (state) {
      state.winner = 'none';
      state.phase = 'ended';
    }
  }
}

module.exports = GameEngine;
