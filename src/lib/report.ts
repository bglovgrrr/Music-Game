/**
 * Sends errors from real phones to /api/log (they end up in Vercel's logs). Only the error
 * itself, the app version, the screen and the browser: never names, songs or typed text.
 * At most 15 reports per page load, and each distinct message only once.
 */
type Kind = 'error' | 'rejection' | 'react' | 'spotify'

const sent = new Set<string>()
let count = 0
let where = 'home'

/** The screen/phase people are on, included with reports. */
export const setReportWhere = (w: string) => {
  where = w
}

export function report(kind: Kind, err: unknown) {
  try {
    if (import.meta.env.DEV || import.meta.env.MODE === 'preview' || import.meta.env.MODE === 'test') return
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')
    const key = `${kind}:${e.message}`
    if (sent.has(key) || count >= 15) return
    sent.add(key)
    count++
    const body = JSON.stringify({
      kind,
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 8).join('\n'),
      where,
      version: `${__APP_VERSION__}+${__APP_COMMIT__}`,
      ua: navigator.userAgent,
    })
    if (!navigator.sendBeacon?.('/api/log', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/log', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
    }
  } catch {
    /* never let reporting break the app */
  }
}

/** Catches errors nothing else handled. */
export function installErrorReporting() {
  window.addEventListener('error', (e) => report('error', e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => report('rejection', e.reason))
}
