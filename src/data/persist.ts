import { store, type SerializedState } from './store'

const KEY = 'mada.store.v1'

export function loadStore(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    store.hydrate(JSON.parse(raw) as SerializedState)
  } catch {
    /* ignore corrupt local data */
  }
}

export function saveStore(): void {
  if (typeof localStorage === 'undefined') return
  const snapshot = store.serialize()
  localStorage.setItem(KEY, JSON.stringify(snapshot))
}

export function persistSession(): void {
  if (typeof localStorage === 'undefined') return
  if (store.session) localStorage.setItem('mada.session', JSON.stringify(store.session))
  else localStorage.removeItem('mada.session')
}

export function loadSession(): void {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem('mada.session')
  if (!raw) return
  try {
    store.session = JSON.parse(raw)
  } catch {
    store.session = null
  }
}
