import { describe, expect, it } from 'vitest'
import { cleanReport } from './log'

describe('error reports from phones', () => {
  it('keeps the useful fields and trims everything', () => {
    const r = cleanReport({
      kind: 'spotify',
      message: 'no_device: Spotify isn’t open',
      stack: 'x'.repeat(5000),
      where: 'listening',
      version: '1.0.0+abc',
      ua: 'iPhone',
      name: 'Brian',
    })
    expect(r).toMatchObject({ kind: 'spotify', message: 'no_device: Spotify isn’t open', where: 'listening' })
    expect(r!.stack!.length).toBe(2000)
    expect(JSON.stringify(r)).not.toContain('Brian')
  })

  it('understands browser CSP reports (old and new formats)', () => {
    expect(cleanReport({ 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://evil.example/x.js' } })!.message).toBe(
      'CSP blocked https://evil.example/x.js (script-src)',
    )
    expect(cleanReport({ type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'https://i.example/a.png' } })!.kind).toBe('csp')
  })

  it('drops junk', () => {
    expect(cleanReport(null)).toBeNull()
    expect(cleanReport({ kind: 'hack', message: 'x' })).toBeNull()
    expect(cleanReport({ kind: 'error', message: '   ' })).toBeNull()
  })
})
