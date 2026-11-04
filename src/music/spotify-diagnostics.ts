import { getAccessToken } from './spotify-auth'
import { chosenDeviceId, LOCAL } from './spotify-player'
import { ensureLocalPlayer, localPlayerProblem } from './spotify-sdk'

type Device = { id: string; name: string; type: string; is_active: boolean; is_restricted?: boolean; volume_percent?: number | null }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Step-by-step check of full-song playback, written as plain lines the host can copy:
 * devices, the play command's reply, and whether Spotify's progress actually moves.
 */
export async function testSpotify(log: (line: string) => void) {
  const token = await getAccessToken()
  if (!token) return log('✗ Not connected to Spotify on this device. Tap Connect first.')
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    let body: unknown = null
    try {
      body = await res.clone().json()
    } catch {
      body = null
    }
    return { status: res.status, body: body as Record<string, unknown> | null }
  }
  const errorText = (b: Record<string, unknown> | null) => {
    const e = b?.error as { message?: string; reason?: string } | undefined
    return e ? ` (${[e.reason, e.message].filter(Boolean).join(': ')})` : ''
  }

  const me = await call('/me')
  log(me.status === 200 ? `✓ Signed in as ${(me.body?.display_name as string) || (me.body?.id as string)}` : `✗ Profile: HTTP ${me.status}${errorText(me.body)}`)

  const dv = await call('/me/player/devices')
  const devices = ((dv.body?.devices as Device[]) ?? []).filter((d) => d.id)
  if (dv.status !== 200) log(`✗ Devices: HTTP ${dv.status}${errorText(dv.body)}`)
  log(`Devices (${devices.length}):`)
  for (const d of devices)
    log(`  • ${d.name} · ${d.type}${d.is_active ? ' · ACTIVE' : ''}${d.is_restricted ? ' · RESTRICTED (can’t be controlled)' : ''} · volume ${d.volume_percent ?? '?'}%`)

  let picked = chosenDeviceId()
  if (!picked || picked === LOCAL) {
    const id = await ensureLocalPlayer()
    log(id ? '✓ Side B’s built-in player is ready' : `✗ Side B’s built-in player: ${localPlayerProblem() ?? 'not ready'}`)
    picked = id
  }
  if (picked && !devices.some((d) => d.id === picked)) {
    const again = await call('/me/player/devices')
    devices.splice(0, devices.length, ...((again.body?.devices as Device[]) ?? []).filter((d) => d.id))
  }
  if (picked && !devices.some((d) => d.id === picked)) {
    for (const ms of [2000, 3000, 4000]) {
      await wait(ms)
      const again = await call('/me/player/devices')
      const listed = ((again.body?.devices as Device[]) ?? []).some((d) => d.id === picked)
      log(`  Spotify lists Side B after +${ms / 1000}s: ${listed ? 'yes' : 'no'}`)
      if (listed) {
        devices.splice(0, devices.length, ...((again.body?.devices as Device[]) ?? []).filter((d) => d.id))
        break
      }
      if (ms === 3000) {
        const t = await call('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [picked], play: false }) })
        log(`  switch playback to Side B: HTTP ${t.status}${errorText(t.body)}`)
      }
    }
  }
  // Side B's own player may not be listed until it has played something: use it directly.
  if (picked && !devices.some((d) => d.id === picked) && (!chosenDeviceId() || chosenDeviceId() === LOCAL)) {
    devices.unshift({ id: picked, name: 'Side B (this device)', type: 'Browser', is_active: false })
  }
  if (!devices.length) return log('✗ No devices. Open Spotify on the phone/computer/speaker and play any song for a second, then test again.')
  const target = devices.find((d) => d.id === picked) ?? devices.find((d) => d.is_active) ?? devices[0]
  log(`Target: ${target.name}${target.id === picked ? ' (picked in Side B)' : target.is_active ? ' (Spotify’s active device)' : ' (first available)'}`)
  if (target.volume_percent === 0) log('⚠ That device’s Spotify volume is 0%.')

  let uri = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'
  try {
    const r = await fetch('/api/spotify-search?q=here%20comes%20the%20sun%20beatles')
    const t = (await r.json()) as { tracks?: { spotifyUri: string; title: string }[] }
    if (t.tracks?.[0]) {
      uri = t.tracks[0].spotifyUri
      log(`Test song: ${t.tracks[0].title}`)
    }
  } catch {
    /* keep default */
  }
  const id = uri.split(':').pop()!

  // 1. Is this song playable for this account?
  const tr = await call(`/tracks/${id}?market=from_token`)
  if (tr.status === 200) {
    const b = tr.body as { is_playable?: boolean; restrictions?: { reason?: string }; album?: { uri?: string }; explicit?: boolean; linked_from?: { uri?: string } }
    log(
      `Song check: playable=${b.is_playable ?? '?'}${b.restrictions?.reason ? ` · restricted: ${b.restrictions.reason}` : ''}${b.explicit ? ' · explicit' : ''}${b.linked_from ? ' · relinked' : ''}`,
    )
  } else log(`Song check: HTTP ${tr.status}${errorText(tr.body)}`)
  const albumUri = (tr.body as { album?: { uri?: string } } | null)?.album?.uri

  // Watch what Spotify does after a command. Returns true when the song is really playing.
  const observe = async (label: string, want: string) => {
    let last: number | null = null
    let ok = false
    for (const ms of [1500, 2000]) {
      await wait(ms)
      const st = await call('/me/player')
      if (st.status === 204 || !st.body) {
        log(`    ${label} +${ms / 1000}s: nothing playing (HTTP ${st.status})`)
        continue
      }
      const b = st.body as {
        is_playing?: boolean
        progress_ms?: number
        item?: { uri?: string; name?: string } | null
        currently_playing_type?: string
        device?: { name?: string; is_private_session?: boolean }
        actions?: { disallows?: Record<string, boolean> }
      }
      const disallows = Object.keys(b.actions?.disallows ?? {}).filter((k) => b.actions!.disallows![k])
      log(
        `    ${label} +${ms / 1000}s: ${b.is_playing ? 'PLAYING' : 'paused'} · ${b.item?.uri === want ? 'test song' : (b.item?.name ?? `no song (${b.currently_playing_type ?? 'unknown'})`)} · ${Math.round((b.progress_ms ?? 0) / 1000)}s${b.device?.is_private_session ? ' · private session' : ''}${disallows.length ? ` · not allowed: ${disallows.join(',')}` : ''}`,
      )
      if (b.item?.uri === want && b.is_playing && last !== null && (b.progress_ms ?? 0) > last) ok = true
      last = b.item?.uri === want ? (b.progress_ms ?? 0) : last
    }
    return ok
  }

  const dev = `device_id=${encodeURIComponent(target.id)}`
  const attempts: [string, () => Promise<{ status: number; body: Record<string, unknown> | null }>][] = [
    [
      '1: play from its album (what Side B uses)',
      () =>
        albumUri
          ? call(`/me/player/play?${dev}`, { method: 'PUT', body: JSON.stringify({ context_uri: albumUri, offset: { uri } }) })
          : Promise.resolve({ status: 0, body: { error: { message: 'album unknown' } } }),
    ],
    ['A: play song', () => call(`/me/player/play?${dev}`, { method: 'PUT', body: JSON.stringify({ uris: [uri], position_ms: 30_000 }) })],
    ['B: play song, no start position', () => call(`/me/player/play?${dev}`, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) })],
    [
      'C: switch to device, then play',
      async () => {
        const t = await call('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [target.id], play: false }) })
        log(`    (switch: HTTP ${t.status}${errorText(t.body)})`)
        await wait(1000)
        return call(`/me/player/play?${dev}`, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) })
      },
    ],
    [
      'E: add to queue, then skip to it',
      async () => {
        const qd = await call(`/me/player/queue?uri=${encodeURIComponent(uri)}&${dev}`, { method: 'POST' })
        log(`    (queue: HTTP ${qd.status}${errorText(qd.body)})`)
        await wait(800)
        return call(`/me/player/next?${dev}`, { method: 'POST' })
      },
    ],
  ]

  const worked: string[] = []
  for (const [label, run] of attempts) {
    const r = await run()
    log(`${label}: HTTP ${r.status}${errorText(r.body)}`)
    if (r.status >= 300 || r.status === 0) continue
    if (await observe(label.split(':')[0], uri)) {
      worked.push(label)
      log(`  ✓ ${label} WORKS`)
      break
    }
  }
  await call('/me/player/pause', { method: 'PUT' })
  log(worked.length ? `RESULT: ${worked[0]}` : 'RESULT: nothing played the test song.')
}
