import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
}
;(globalThis as { window?: unknown }).window = { addEventListener() {}, removeEventListener() {}, location: { origin: 'https://x' } }
vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client123')

const sdk = vi.hoisted(() => ({ id: null as string | null }))
vi.mock('./spotify-sdk', () => ({
  ensureLocalPlayer: async () => sdk.id,
  localDeviceId: () => sdk.id,
}))

const { getAccessToken, isSpotifyConnected, SCOPES } = await import('./spotify-auth')
const { chooseDevice, pausePlayback, playTrack, seekTo } = await import('./spotify-player')

type Call = { url: string; method: string; body?: unknown }
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function fakeSpotify(handler: (c: Call) => Response) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const c: Call = { url: String(url), method: init?.method ?? 'GET', body: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : init?.body }
      calls.push(c)
      return handler(c)
    }),
  )
  return calls
}

const signedIn = (overrides: Record<string, unknown> = {}) =>
  store.set('sideb:spotify-token', JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_at: Date.now() + 3_600_000, scope: SCOPES.join(' '), ...overrides }))

beforeEach(() => {
  store.clear()
  signedIn()
  sdk.id = null
})
afterEach(() => vi.unstubAllGlobals())

const devices = { devices: [{ id: 'phone', name: 'iPhone', type: 'Smartphone', is_active: false }, { id: 'sonos', name: 'Living Room', type: 'Speaker', is_active: true }] }

describe('Spotify playback control', () => {
  it('starts the song from its album (bare-track playback plays nothing in Development Mode)', async () => {
    const calls = fakeSpotify((c) => (c.url.endsWith('/me/player/devices') ? json(200, devices) : json(204)))
    await playTrack('spotify:track:1', 12_345.6, 'spotify:album:A')
    const play = calls.find((c) => c.url.includes('/me/player/play'))!
    expect(play.method).toBe('PUT')
    expect(play.url).toContain('device_id=sonos')
    expect(play.body).toEqual({ context_uri: 'spotify:album:A', offset: { uri: 'spotify:track:1' }, position_ms: 12_346 })
  })

  it('looks up the album when the pick does not know it (once per song)', async () => {
    const calls = fakeSpotify((c) =>
      c.url.endsWith('/me/player/devices') ? json(200, devices) : c.url.includes('/tracks/7') ? json(200, { album: { uri: 'spotify:album:B' } }) : json(204),
    )
    await playTrack('spotify:track:7', 0)
    await playTrack('spotify:track:7', 5000)
    expect(calls.filter((c) => c.url.includes('/tracks/7'))).toHaveLength(1)
    expect(calls.filter((c) => c.url.includes('/me/player/play')).map((c) => c.body)).toEqual([
      { context_uri: 'spotify:album:B', offset: { uri: 'spotify:track:7' }, position_ms: 0 },
      { context_uri: 'spotify:album:B', offset: { uri: 'spotify:track:7' }, position_ms: 5000 },
    ])
  })

  it('falls back to playing the bare song if the album is unknown', async () => {
    const calls = fakeSpotify((c) => (c.url.endsWith('/me/player/devices') ? json(200, devices) : c.url.includes('/tracks/') ? json(404, {}) : json(204)))
    await playTrack('spotify:track:9', 0)
    expect(calls.find((c) => c.url.includes('/me/player/play'))!.body).toEqual({ uris: ['spotify:track:9'], position_ms: 0 })
  })

  it('plays inside Side B by default when its built-in player is ready (no Spotify app needed)', async () => {
    sdk.id = 'sideb-local'
    const calls = fakeSpotify(() => json(204))
    await playTrack('spotify:track:1', 0, 'spotify:album:A')
    expect(calls.some((c) => c.url.endsWith('/me/player/devices'))).toBe(false)
    expect(calls.find((c) => c.url.includes('/me/player/play'))!.url).toContain('device_id=sideb-local')
  })

  it('falls back to Spotify devices when the built-in player can’t run here', async () => {
    const calls = fakeSpotify((c) => (c.url.endsWith('/me/player/devices') ? json(200, devices) : json(204)))
    await playTrack('spotify:track:1', 0, 'spotify:album:A')
    expect(calls.find((c) => c.url.includes('/me/player/play'))!.url).toContain('device_id=sonos')
  })

  it('uses the device picked in Side B', async () => {
    chooseDevice('phone')
    const calls = fakeSpotify((c) => (c.url.endsWith('/me/player/devices') ? json(200, devices) : json(204)))
    await playTrack('spotify:track:1', 0, 'spotify:album:A')
    expect(calls.find((c) => c.url.includes('/me/player/play'))!.url).toContain('device_id=phone')
  })

  it('explains what to do when Spotify is not open anywhere', async () => {
    fakeSpotify(() => json(200, { devices: [] }))
    await expect(playTrack('spotify:track:1', 0)).rejects.toThrow(/Open the Spotify app/)
  })

  it('explains Premium and allowlist problems', async () => {
    fakeSpotify((c) => (c.url.endsWith('/devices') ? json(200, devices) : json(403, { error: { reason: 'PREMIUM_REQUIRED' } })))
    await expect(playTrack('spotify:track:1', 0)).rejects.toThrow(/Premium/)
    fakeSpotify((c) => (c.url.endsWith('/devices') ? json(200, devices) : json(403, { error: { message: 'Forbidden' } })))
    await expect(playTrack('spotify:track:1', 0)).rejects.toThrow(/User Management/)
  })

  it('pause and seek send the right commands; pausing with nothing playing is fine', async () => {
    const calls = fakeSpotify((c) => (c.url.includes('/pause') ? json(404, { error: { reason: 'NO_ACTIVE_DEVICE' } }) : json(204)))
    await expect(pausePlayback()).resolves.toBeUndefined()
    await seekTo(61_000)
    expect(calls.map((c) => `${c.method} ${c.url.replace('https://api.spotify.com/v1', '')}`)).toEqual(['PUT /me/player/pause', 'PUT /me/player/seek?position_ms=61000'])
  })
})

describe('Spotify sign-in', () => {
  it('refreshes an expired sign-in automatically and keeps the refresh token', async () => {
    signedIn({ expires_at: Date.now() - 1 })
    const calls = fakeSpotify(() => json(200, { access_token: 'new', expires_in: 3600, scope: SCOPES.join(' ') }))
    expect(await getAccessToken()).toBe('new')
    expect(String(calls[0].body)).toContain('grant_type=refresh_token')
    expect(JSON.parse(store.get('sideb:spotify-token')!).refresh_token).toBe('ref')
  })

  it('asks to reconnect when an old sign-in lacks the playback permissions', () => {
    signedIn({ scope: 'playlist-modify-private' })
    expect(isSpotifyConnected()).toBe(false)
  })

  it('signs out when Spotify rejects the sign-in', async () => {
    fakeSpotify((c) => (c.url.endsWith('/devices') ? json(401, {}) : json(204)))
    await expect(playTrack('spotify:track:1', 0)).rejects.toThrow(/Connect again/)
    expect(isSpotifyConnected()).toBe(false)
  })
})
