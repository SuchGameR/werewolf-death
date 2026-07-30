export function useUtils() {
  function esc(str: string): string {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  function avatarHTML(name: string, size: number): string {
    const color = stringToColor(name)
    const initial = name.charAt(0).toUpperCase()
    return `<div class="avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${size * 0.45}px">${esc(initial)}</div>`
  }

  function nameWithAvatar(name: string, size: number): string {
    return avatarHTML(name, size) + `<span class="name-text">${esc(name)}</span>`
  }

  function roleLabel(role: string): string {
    const labels: Record<string, string> = { wolf: '🐺 人狼', spy: '🕵️ スパイ', spectator: '👀 観戦' }
    return labels[role] || role
  }

  function roleClass(role: string): string {
    const map: Record<string, string> = { wolf: 'role-wolf', spy: 'role-spy', spectator: 'role-spec' }
    return map[role] || ''
  }

  function phaseLabel(phase: string): string {
    const labels: Record<string, string> = {
      attack_vote: '襲撃決議', night_attack: '夜襲', report: '通報決議',
      starvation_check: '飢餓チェック', win_check: '勝利判定', ended: '終了'
    }
    return labels[phase] || phase
  }

  return { esc, avatarHTML, nameWithAvatar, roleLabel, roleClass, phaseLabel }
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 50%)`
}
