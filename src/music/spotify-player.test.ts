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
const { chooseDevice, pausePlayback, playTrack, seekTo, setKeepAliveDevice, SILENCE, localPlayerUsable } = await import('./spotify-player')

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
  setKeepAliveDevice(null)
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

  it('retries the built-in player when Spotify does not know it yet (switching playback to it first)', async () => {
    sdk.id = 'sideb-local'
    let plays = 0
    const calls = fakeSpotify((c) => {
      if (c.url.includes('/me/player/play')) return ++plays < 2 ? json(404, { error: { message: 'Device not found' } }) : json(204)
      return json(204)
    })
    vi.useFakeTimers()
    const p = playTrack('spotify:track:1', 0, 'spotify:album:A')
    await vi.runAllTimersAsync()
    await p
    vi.useRealTimers()
    expect(plays).toBe(2)
    expect(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/me/player') && JSON.stringify(c.body).includes('sideb-local'))).toBe(true)
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
    await expect(playTrack('spotify:track:1', 0)).rejects.toThrow(/Spotify isn’t open/)
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

describe('keeping a phone’s Spotify awake', () => {
  const phoneDevices = { devices: [{ id: 'iphone', name: 'iPhone', type: 'Smartphone', is_active: true }] }

  it('pausing on a kept-awake phone plays silence instead (a paused Spotify app gets put to sleep by iOS)', async () => {
    setKeepAliveDevice('iphone')
    const calls = fakeSpotify(() => json(204))
    await pausePlayback()
    expect(calls.map((c) => c.url.replace('https://api.spotify.com/v1', ''))).toEqual(['/me/player/play?device_id=iphone', '/me/player/repeat?state=context&device_id=iphone'])
    expect(calls[0].body).toEqual({ context_uri: SILENCE.album, offset: { uri: SILENCE.uri }, position_ms: 0 })
  })

  it('pausing anywhere else really pauses', async () => {
    const calls = fakeSpotify(() => json(204))
    await pausePlayback()
    expect(calls.map((c) => c.url.replace('https://api.spotify.com/v1', ''))).toEqual(['/me/player/pause'])
  })

  it('when the built-in player is unreachable, switches to the Spotify app automatically and remembers', async () => {
    sdk.id = 'sideb-local'
    vi.useFakeTimers()
    const calls = fakeSpotify((c) => {
      if (c.url.endsWith('/me/player/devices')) return json(200, phoneDevices)
      if (c.url.includes('/me/player/play') && c.url.includes('sideb-local')) return json(404, { error: { message: 'Device not found' } })
      return json(204)
    })
    const p = playTrack('spotify:track:1', 0, 'spotify:album:A')
    await vi.runAllTimersAsync()
    const device = await p
    vi.useRealTimers()
    expect(device.id).toBe('iphone')
    expect(calls.filter((c) => c.url.includes('/me/player/play')).at(-1)!.url).toContain('device_id=iphone')
    expect(localPlayerUsable()).toBe(false)
  })

  it('on iPhone, skips the built-in player and uses the phone’s Spotify app', async () => {
    const nav = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }, configurable: true })
    try {
      sdk.id = 'sideb-local'
      expect(localPlayerUsable()).toBe(false)
      const calls = fakeSpotify((c) => (c.url.endsWith('/me/player/devices') ? json(200, phoneDevices) : json(204)))
      await playTrack('spotify:track:1', 0, 'spotify:album:A')
      expect(calls.find((c) => c.url.includes('/me/player/play'))!.url).toContain('device_id=iphone')
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true })
    }
  })
})

describe('keeping a phone’s Spotify awake', () => {
  it('plays the silence on repeat, so it keeps going while the host’s phone is locked', async () => {
    const calls = fakeSpotify(() => json(204))
    setKeepAliveDevice('phone')
    await pausePlayback()
    const play = calls.find((c) => c.url.includes('/me/player/play'))!
    expect(play.url).toContain('device_id=phone')
    expect(play.body).toMatchObject({ context_uri: SILENCE.album })
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/me/player/repeat?state=context') && c.url.includes('device_id=phone'))).toBe(true)
  })

  it('songs themselves do not repeat', async () => {
    const calls = fakeSpotify((c) => (c.url.endsWith('/me/player/devices') ? json(200, devices) : json(204)))
    await playTrack('spotify:track:1', 0, 'spotify:album:A')
    await new Promise((r) => setTimeout(r, 0))
    expect(calls.some((c) => c.url.includes('/me/player/repeat?state=off'))).toBe(true)
  })

  it('when a phone that just dozed off says "no active device", hands playback to it and retries once', async () => {
    chooseDevice('phone')
    let plays = 0
    const calls = fakeSpotify((c) => {
      if (c.url.endsWith('/me/player/devices')) return json(200, devices)
      if (c.url.includes('/me/player/play')) return ++plays === 1 ? json(404, { error: { message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } }) : json(204)
      return json(204)
    })
    const device = await playTrack('spotify:track:1', 0, 'spotify:album:A')
    expect(device.id).toBe('phone')
    const transfer = calls.find((c) => c.method === 'PUT' && c.url.endsWith('/me/player'))!
    expect(transfer.body).toEqual({ device_ids: ['phone'], play: true })
    expect(plays).toBe(2)
  })

  it('gives the wake-up hint when the phone has dropped off the list entirely', async () => {
    chooseDevice('phone')
    fakeSpotify((c) => {
      if (c.url.endsWith('/me/player/devices')) return json(200, { devices: [] })
      return json(204)
    })
    await expect(playTrack('spotify:track:1', 0, 'spotify:album:A')).rejects.toThrow(/Spotify isn’t open/)
  })
})

describe('waking Spotify on an iPhone', () => {
  it('remembers that Spotify was just opened, so the game can resume by itself on return', async () => {
    const { wakeSpotify, justWoke, clearWoke, setPhoneSpotify, phoneSpotify, onPhoneSpotify } = await import('./spotify-player')
    expect(justWoke()).toBe(false)
    wakeSpotify()
    expect((globalThis as unknown as { window: { location: { href: string } } }).window.location.href).toBe('spotify:')
    expect(justWoke()).toBe(true)
    clearWoke()
    expect(justWoke()).toBe(false)
    let calls = 0
    const off = onPhoneSpotify(() => calls++)
    setPhoneSpotify('asleep')
    setPhoneSpotify('asleep')
    expect(phoneSpotify()).toBe('asleep')
    expect(calls).toBe(1)
    off()
    setPhoneSpotify('unknown')
  })
})
