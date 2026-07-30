export interface WolfData {
  name: string
  starveDays: number
  isAlive: boolean
  isNailClipped: boolean
}

export interface SpyData {
  name: string
  isAlive: boolean
  nailClipperUsed: boolean
  arsonUsed: boolean
  flareUsed: boolean
}

export interface GameState {
  phase: string
  turn: number
  wolves: WolfData[]
  spy: SpyData
  votes: { attack: Record<string, string>; nightAttack: Record<string, string>; report: Record<string, string> }
  attackBlocked: boolean
  reportSkipped: boolean
  warningUsedThisTurn: boolean
  lastAttackResult: string | null
  nightAttackResult: string | null
  reportResult: string | null
  winner: string | null
  log: any[]
  skipNextAttack: boolean
  playerRoles: Record<string, string>
}

class GameEngine {
  games = new Map<string, GameState>()

  initGame(roomCode: string, players: any[], settings: any): GameState {
    if (players.length < 3) throw new Error('プレイヤーは3人以上必要です')

    const shuffled = [...players]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const spy = shuffled[0]
    const wolves = shuffled.slice(1)

    const state: GameState = {
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
    }

    players.forEach(p => {
      state.playerRoles[p.userName] = p.userName === spy.userName ? 'spy' : 'wolf'
    })

    state.log.push({ turn: 0, type: 'system', message: 'ゲーム開始！役職が割り振られました。' })
    state.log.push({ turn: 0, type: 'system', message: `人狼: ${wolves.map(w => w.userName).join(', ')}` })
    state.log.push({ turn: 0, type: 'system', message: `スパイ: ${spy.userName}` })

    this.games.set(roomCode, state)
    return state
  }

  getState(roomCode: string): GameState | null {
    return this.games.get(roomCode) || null
  }

  addLog(roomCode: string, entry: any) {
    const state = this.games.get(roomCode)
    if (state) state.log.push({ turn: state.turn, ...entry })
  }

  resetVotes(state: GameState) {
    state.votes = { attack: {}, nightAttack: {}, report: {} }
    state.warningUsedThisTurn = false
  }

  getAliveWolves(state: GameState): WolfData[] {
    return state.wolves.filter(w => w.isAlive)
  }

  getAliveNames(state: GameState): Set<string> {
    const s = new Set<string>()
    state.wolves.filter(w => w.isAlive).forEach(w => s.add(w.name))
    if (state.spy.isAlive) s.add(state.spy.name)
    return s
  }

  canAct(state: GameState, userName: string): boolean {
    if (state.winner) return false
    if (state.spy.name === userName) return state.spy.isAlive
    const wolf = state.wolves.find(w => w.name === userName)
    return wolf ? wolf.isAlive : false
  }

  // === ATTACK VOTE ===

  beginAttackPhase(roomCode: string) {
    const state = this.games.get(roomCode)
    if (!state) return
    this.resetVotes(state)

    if (state.skipNextAttack) {
      state.skipNextAttack = false
      state.lastAttackResult = 'skipped'
      this.addLog(roomCode, { type: 'system', message: '通報の影響により襲撃はスキップされました。' })
      this.transitionFrom(roomCode, 'attack_vote')
      return
    }

    state.phase = 'attack_vote'
    this.addLog(roomCode, { type: 'phase', message: `=== ${state.turn}ターン目: 襲撃決議 ===` })
  }

  handleVoteAttack(roomCode: string, userName: string, vote: string) {
    const state = this.games.get(roomCode)
    if (!state || state.phase !== 'attack_vote') return { error: '現在この操作はできません' }
    if (!['yes', 'no'].includes(vote)) return { error: '無効な投票です' }
    if (!this.canAct(state, userName)) return { error: '行動できません' }
    if (state.votes.attack[userName] != null) return { error: '既に投票済みです' }

    state.votes.attack[userName] = vote
    const aliveWolves = this.getAliveWolves(state)
    if (Object.keys(state.votes.attack).length >= aliveWolves.length) {
      this.resolveAttackVote(roomCode)
    }
    return { success: true }
  }

  resolveAttackVote(roomCode: string) {
    const state = this.games.get(roomCode)!
    const votes = state.votes.attack
    let yes = 0, no = 0
    Object.values(votes).forEach(v => { if (v === 'yes') yes++; else no++ })

    let success = yes > no
    if (state.warningUsedThisTurn) {
      success = yes === this.getAliveWolves(state).length
    }
    if (state.attackBlocked) {
      success = false
      state.attackBlocked = false
    }

    if (success) {
      state.wolves.forEach(w => { if (w.isAlive) w.starveDays += 0.5 })
      state.lastAttackResult = 'success'
      this.addLog(roomCode, { type: 'attack', message: `村の襲撃に成功！全人狼の飢餓日数+0.5` })
    } else {
      state.wolves.forEach(w => { if (w.isAlive) w.starveDays -= 1 })
      state.lastAttackResult = 'fail'
      this.addLog(roomCode, { type: 'attack', message: `村の襲撃に失敗！全人狼の飢餓日数-1` })
    }
    this.transitionFrom(roomCode, 'attack_vote')
  }

  autoResolveAttackVote(roomCode: string) {
    const state = this.games.get(roomCode)
    if (!state || state.phase !== 'attack_vote') return
    const aliveWolves = this.getAliveWolves(state)
    aliveWolves.forEach(w => {
      if (state.votes.attack[w.name] == null) state.votes.attack[w.name] = 'no'
    })
    if (state.spy.isAlive && state.votes.attack[state.spy.name] == null) {
      state.votes.attack[state.spy.name] = 'no'
    }
    this.resolveAttackVote(roomCode)
  }

  // === NIGHT ATTACK ===

  handleVoteNightAttack(roomCode: string, userName: string, targetName: string) {
    const state = this.games.get(roomCode)
    if (!state || state.phase !== 'night_attack') return { error: '現在この操作はできません' }
    if (!this.canAct(state, userName)) return { error: '行動できません' }
    if (state.votes.nightAttack[userName] != null) return { error: '既に投票済みです' }

    const alive = this.getAliveNames(state)
    if (targetName && !alive.has(targetName)) return { error: '無効な対象です' }
    if (targetName === userName) return { error: '自分を襲撃できません' }

    const wolf = state.wolves.find(w => w.name === userName)
    if (wolf && wolf.isNailClipped) {
      return { error: '爪切りの影響で襲撃できません' }
    }

    state.votes.nightAttack[userName] = targetName || ''
    const aliveWolves = this.getAliveWolves(state)
    if (Object.keys(state.votes.nightAttack).length >= aliveWolves.length) {
      this.resolveNightAttack(roomCode)
    }
    return { success: true }
  }

  resolveNightAttack(roomCode: string) {
    const state = this.games.get(roomCode)!
    const votes = state.votes.nightAttack
    const targetVotes: Record<string, number> = {}
    Object.values(votes).forEach(target => {
      if (target) targetVotes[target] = (targetVotes[target] || 0) + 1
    })

    let maxVotes = 0
    let selectedTarget = ''
    Object.entries(targetVotes).forEach(([target, count]) => {
      if (count > maxVotes) { maxVotes = count; selectedTarget = target }
    })

    if (!selectedTarget || maxVotes < 2) {
      state.nightAttackResult = 'failed'
      this.addLog(roomCode, { type: 'night', message: `夜襲は失敗した（対象不在または投票不足）` })
    } else if (selectedTarget === state.spy.name) {
      state.winner = 'wolf'
      state.nightAttackResult = 'spy_killed'
      state.spy.isAlive = false
      this.addLog(roomCode, { type: 'night', message: `スパイ ${state.spy.name} が発見され、排除された。人狼の勝利！` })
    } else {
      const wolf = state.wolves.find(w => w.name === selectedTarget)
      if (wolf) {
        wolf.isAlive = false
        state.nightAttackResult = 'wolf_killed'
        this.addLog(roomCode, { type: 'night', message: `同士討ち… ${wolf.name} が倒れた。` })
      }
    }

    if (!state.winner) {
      this.transitionFrom(roomCode, 'night_attack')
    }
  }

  autoResolveNightAttack(roomCode: string) {
    const state = this.games.get(roomCode)
    if (!state || state.phase !== 'night_attack') return
    const aliveWolves = this.getAliveWolves(state)
    aliveWolves.forEach(w => {
      if (state.votes.nightAttack[w.name] == null) state.votes.nightAttack[w.name] = ''
    })
    this.resolveNightAttack(roomCode)
  }

  // === REPORT ===

  beginReport(roomCode: string) {
    const state = this.games.get(roomCode)
    if (!state) return
    state.phase = 'report'
    state.votes.report = {}
    this.addLog(roomCode, { type: 'phase', message: `=== ${state.turn}ターン目: 通報決議 ===` })
    if (state.reportSkipped) {
      state.reportSkipped = false
      state.reportResult = 'skipped'
      this.addLog(roomCode, { type: 'system', message: '放火の影響で通報決議はスキップされました。' })
      this.transitionFrom(roomCode, 'report')
    }
  }

  handleVoteReport(roomCode: string, userName: string, vote: string) {
    const state = this.games.get(roomCode)
    if (!state || state.phase !== 'report') return { error: '現在この操作はできません' }
    if (!['yes', 'no'].includes(vote)) return { error: '無効な投票です' }
    if (!this.canAct(state, userName)) return { error: '行動できません' }
    if (state.votes.report[userName] != null) return { error: '既に投票済みです' }

    state.votes.report[userName] = vote
    const aliveNames = this.getAliveNames(state)
    if (Object.keys(state.votes.report).length >= aliveNames.size) {
      this.resolveReport(roomCode)
    }
    return { success: true }
  }

  resolveReport(roomCode: string) {
    const state = this.games.get(roomCode)!
    const votes = state.votes.report
    let yes = 0, no = 0
    Object.values(votes).forEach(v => { if (v === 'yes') yes++; else no++ })

    if (yes > no) {
      state.reportResult = 'success'
      state.skipNextAttack = true
      this.addLog(roomCode, { type: 'report', message: '通報が受理されました。次回の襲撃がスキップされます。' })
    } else {
      state.reportResult = 'fail'
      this.addLog(roomCode, { type: 'report', message: '通報は否決されました。' })
    }
    this.transitionFrom(roomCode, 'report')
  }

  autoResolveReport(roomCode: string) {
    const state = this.games.get(roomCode)
    if (!state || state.phase !== 'report') return
    const aliveNames = this.getAliveNames(state)
    aliveNames.forEach(name => {
      if (state.votes.report[name] == null) state.votes.report[name] = 'no'
    })
    this.resolveReport(roomCode)
  }

  // === TRANSITION ===

  transitionFrom(roomCode: string, fromPhase: string) {
    const state = this.games.get(roomCode)
    if (!state) return

    if (fromPhase === 'attack_vote') {
      if (state.turn >= 2) {
        state.phase = 'night_attack'
        this.addLog(roomCode, { type: 'phase', message: `=== ${state.turn}ターン目: 夜襲 ===` })
      } else {
        this.beginReport(roomCode)
      }
      return
    }

    if (fromPhase === 'night_attack') {
      this.beginReport(roomCode)
      return
    }

    if (fromPhase === 'report') {
      this.checkStarvation(roomCode)
      return
    }
  }

  // === STARVATION ===

  checkStarvation(roomCode: string) {
    const state = this.games.get(roomCode)!
    state.phase = 'starvation_check'
    this.addLog(roomCode, { type: 'phase', message: `=== ${state.turn}ターン目: 飢餓チェック ===` })

    const starved: string[] = []
    state.wolves.forEach(w => {
      if (w.isAlive && w.starveDays <= 0) {
        w.isAlive = false
        starved.push(w.name)
      }
    })
    if (starved.length > 0) {
      this.addLog(roomCode, { type: 'system', message: `${starved.join(', ')} が飢えで脱落した。` })
    } else {
      this.addLog(roomCode, { type: 'system', message: '飢えた人狼はいません。' })
    }

    this.checkWin(roomCode)
  }

  // === WIN CHECK ===

  checkWin(roomCode: string) {
    const state = this.games.get(roomCode)!
    state.phase = 'win_check'

    const aliveWolves = this.getAliveWolves(state)
    if (aliveWolves.length === 0) {
      state.winner = 'human'
      this.addLog(roomCode, { type: 'system', message: '全人狼が死亡。スパイの勝利！' })
    } else if (!state.spy.isAlive) {
      state.winner = 'wolf'
      this.addLog(roomCode, { type: 'system', message: 'スパイが死亡。人狼の勝利！' })
    } else {
      state.turn++
      this.beginAttackPhase(roomCode)
      return
    }

    state.phase = 'ended'
    this.addLog(roomCode, { type: 'system', message: '=== ゲーム終了 ===' })
  }

  // === SPY ABILITIES ===

  handleSpyAbility(roomCode: string, userName: string, ability: string, targetName?: string) {
    const state = this.games.get(roomCode)
    if (!state) return { error: 'ゲームが見つかりません' }
    if (state.spy.name !== userName) return { error: 'スパイのみ使用可能です' }
    if (!state.spy.isAlive) return { error: '死亡しているため使用できません' }

    switch (ability) {
      case 'flare': {
        if (state.spy.flareUsed) return { error: '信号弾は既に使用済みです' }
        if (state.phase !== 'attack_vote') return { error: '襲撃決議フェーズでのみ使用可能です' }
        state.spy.flareUsed = true
        state.attackBlocked = true
        this.addLog(roomCode, { type: 'spy', message: 'スパイが信号弾を使用！襲撃は失敗する。' })
        return { success: true }
      }
      case 'warning': {
        if (state.warningUsedThisTurn) return { error: '警告は既に使用済みです' }
        if (state.phase !== 'attack_vote') return { error: '襲撃決議フェーズでのみ使用可能です' }
        state.warningUsedThisTurn = true
        this.addLog(roomCode, { type: 'spy', message: 'スパイが警告を発した！襲撃成功には全員一致が必要。' })
        return { success: true }
      }
      case 'nailClipper': {
        if (state.spy.nailClipperUsed) return { error: '爪切りは既に使用済みです' }
        if (state.phase !== 'night_attack') return { error: '夜襲フェーズでのみ使用可能です' }
        if (!targetName) return { error: '対象を指定してください' }
        const wolf = state.wolves.find(w => w.name === targetName)
        if (!wolf || !wolf.isAlive) return { error: '無効な対象です' }
        state.spy.nailClipperUsed = true
        wolf.isNailClipped = true
        this.addLog(roomCode, { type: 'spy', message: `スパイが爪切りを使用！${wolf.name}は今ターン襲撃できない。` })
        return { success: true }
      }
      case 'arson': {
        if (state.spy.arsonUsed) return { error: '放火は既に使用済みです' }
        if (state.phase !== 'report') return { error: '通報決議フェーズでのみ使用可能です' }
        state.spy.arsonUsed = true
        state.reportSkipped = true
        this.addLog(roomCode, { type: 'spy', message: 'スパイが放火！通報決議がスキップされる。' })
        return { success: true }
      }
      default:
        return { error: '不明な能力です' }
    }
  }

  // === FORCE END ===

  forceEnd(roomCode: string) {
    const state = this.games.get(roomCode)
    if (!state) return
    state.phase = 'ended'
    state.winner = 'force_end'
    this.addLog(roomCode, { type: 'system', message: '=== 強制終了 ===' })
  }
}

export const gameEngine = new GameEngine()
