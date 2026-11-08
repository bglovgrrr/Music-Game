import { useEffect, useSyncExternalStore } from 'react'
import { safeStorage } from '@/lib/utils'

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'mm:theme'
const listeners = new Set<() => void>()
let choice: ThemeChoice = (() => {
  const saved = safeStorage.get(KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
})()

function apply() {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

export function setTheme(next: ThemeChoice) {
  choice = next
  safeStorage.set(KEY, next)
  apply()
  listeners.forEach((l) => l())
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function subscribe(l: () => void) {
  listeners.add(l)
  const m = media()
  m.addEventListener('change', l)
  return () => {
    listeners.delete(l)
    m.removeEventListener('change', l)
  }
}

/** The user's choice plus what is actually showing ('light' or 'dark'). */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => choice)
  const systemDark = useSyncExternalStore(subscribe, () => media().matches)
  useEffect(apply, [current])
  const resolved: 'light' | 'dark' = current === 'system' ? (systemDark ? 'dark' : 'light') : current
  return { choice: current, resolved, setTheme }
}
