/**
 * What the browser may send to /api/log, cleaned up before it's written to the logs.
 * Kept separate from the function so it can be tested.
 */
export type ClientReport = {
  kind: 'error' | 'rejection' | 'react' | 'spotify' | 'csp'
  message: string
  stack?: string
  where?: string
  version?: string
  ua?: string
}

const KINDS = new Set(['error', 'rejection', 'react', 'spotify', 'csp'])
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined)

/** Accepts our own reports and browsers' CSP violation reports; drops anything else. */
export function cleanReport(body: unknown): ClientReport | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  // Browser CSP reports: { "csp-report": { ... } } or the newer [{ type: "csp-violation", body: {...} }]
  const csp = (b['csp-report'] ?? (b.type === 'csp-violation' ? b.body : undefined)) as Record<string, unknown> | undefined
  if (csp && typeof csp === 'object') {
    const directive = clip(csp['violated-directive'] ?? csp.effectiveDirective ?? csp['effective-directive'], 80)
    const blocked = clip(csp['blocked-uri'] ?? csp.blockedURL, 200)
    return { kind: 'csp', message: `CSP blocked ${blocked ?? '?'} (${directive ?? '?'})`, where: clip(csp['document-uri'] ?? csp.documentURL, 200) }
  }
  if (!KINDS.has(b.kind as string) || typeof b.message !== 'string' || !b.message.trim()) return null
  return {
    kind: b.kind as ClientReport['kind'],
    message: clip(b.message, 500)!,
    stack: clip(b.stack, 2000),
    where: clip(b.where, 200),
    version: clip(b.version, 40),
    ua: clip(b.ua, 200),
  }
}
