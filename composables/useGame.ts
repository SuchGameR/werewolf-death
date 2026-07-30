import type { Ref } from 'vue'

export interface GameState {
  phase: string
  turn: number
  wolves: { name: string; starveDays: number; isAlive: boolean; isNailClipped: boolean }[]
  spy: { name: string; isAlive: boolean; nailClipperUsed: boolean; arsonUsed: boolean; flareUsed: boolean }
  votes: { attack: Record<string, string>; nightAttack: Record<string, string>; report: Record<string, string> }
  lastAttackResult: string | null
  nightAttackResult: string | null
  reportResult: string | null
  skipNextAttack: boolean
  warningUsedThisTurn: boolean
  winner: string | null
  log: any[]
  spectators: any[]
  playerRoles: Record<string, string>
}

export function useGame() {
  const { esc, avatarHTML, roleLabel, roleClass, phaseLabel } = useUtils()

  function aliveNames(state: GameState): string[] {
    const t: string[] = []
    state.wolves.forEach(w => { if (w.isAlive) t.push(w.name) })
    if (state.spy && state.spy.isAlive) t.push(state.spy.name)
    return t
  }

  function isAlive(state: GameState, userName: string, myRole: string): boolean {
    if (myRole === 'spy') return state.spy && state.spy.isAlive
    if (myRole === 'wolf') {
      const w = state.wolves.find(x => x.name === userName)
      return w && w.isAlive
    }
    return false
  }

  function hasVoted(state: GameState, userName: string): boolean {
    const v = state.votes
    if (state.phase === 'attack_vote') return v.attack[userName] != null
    if (state.phase === 'night_attack') return v.nightAttack[userName] != null
    if (state.phase === 'report') return v.report[userName] != null
    return false
  }

  function voteProgressHTML(state: GameState, eligibleNames: string[]): string {
    const v = state.votes
    const phase = state.phase
    let votes: Record<string, string> = {}
    if (phase === 'attack_vote') votes = v.attack
    else if (phase === 'night_attack') votes = v.nightAttack
    else if (phase === 'report') votes = v.report

    const items = eligibleNames.map(name => {
      const val = votes[name]
      let dotClass = 'pending'
      let label = '未'
      if (val === 'yes' || (val && val !== '' && val !== 'no')) { dotClass = 'yes'; label = '⭕' }
      else if (val === 'no') { dotClass = 'no'; label = '❌' }
      else if (val === '') { dotClass = 'abstain'; label = '—' }
      return `<div class="vote-progress-item">${avatarHTML(name, 20)}<span class="vote-dot ${dotClass}"></span><span class="text-sm">${label}</span></div>`
    })
    if (items.length === 0) return ''
    return `<div class="vote-progress">${items.join('')}</div>`
  }

  return { aliveNames, isAlive, hasVoted, voteProgressHTML, esc, avatarHTML, roleLabel, roleClass, phaseLabel }
}
