export function useStorage() {
  function get(key: string): string | null {
    if (import.meta.client) return sessionStorage.getItem(key)
    return null
  }

  function set(key: string, value: string) {
    if (import.meta.client) sessionStorage.setItem(key, value)
  }

  function remove(key: string) {
    if (import.meta.client) sessionStorage.removeItem(key)
  }

  return { get, set, remove }
}
