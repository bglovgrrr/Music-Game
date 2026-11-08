import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10)
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sample<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** localStorage that never throws (private mode, blocked storage, sandboxed previews). */
/**
 * Saved data used the old "sideb:" prefix (from when the app was called Side B). Copy it to
 * the "mm:" prefix once, so nobody loses their name, Spotify login, theme or game.
 */
export function migrateStorageKeys() {
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      if (!store) continue
      const old = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => !!k && k.startsWith('sideb:'))
      for (const k of old) {
        const next = `mm:${k.slice('sideb:'.length)}`
        if (store.getItem(next) === null) store.setItem(next, store.getItem(k) ?? '')
        store.removeItem(k)
      }
    } catch {
      /* storage blocked: nothing to move */
    }
  }
}

export const safeStorage = {
  get(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
}
