export function useToast() {
  let timeout: ReturnType<typeof setTimeout> | null = null

  function show(msg: string, isError = false) {
    const el = document.getElementById('toast')
    if (!el) return
    if (timeout) clearTimeout(timeout)
    el.textContent = msg
    el.className = 'toast' + (isError ? ' error' : '')
    el.style.display = 'block'
    timeout = setTimeout(() => { el.style.display = 'none'; el.className = 'toast' }, 3000)
  }

  return { show }
}
