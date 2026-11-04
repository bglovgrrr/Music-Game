import { getAccessToken } from './spotify-auth'
import { chosenDeviceId } from './spotify-player'

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
  if (!devices.length) return log('✗ No devices. Open Spotify on the phone/computer/speaker and play any song for a second, then test again.')

  const picked = chosenDeviceId()
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

  const play = await call(`/me/player/play?device_id=${encodeURIComponent(target.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri], position_ms: 30_000 }),
  })
  log(play.status < 300 ? `✓ Play command accepted (HTTP ${play.status})` : `✗ Play command refused: HTTP ${play.status}${errorText(play.body)}`)

  let last: number | null = null
  for (const ms of [1500, 2500, 3000]) {
    await wait(ms)
    const st = await call('/me/player')
    if (st.status === 204 || !st.body) {
      log(`  after ${ms / 1000}s: Spotify reports nothing playing (HTTP ${st.status})`)
      continue
    }
    const item = st.body.item as { uri?: string; name?: string } | undefined
    const device = st.body.device as { name?: string; volume_percent?: number } | undefined
    const progress = st.body.progress_ms as number
    log(
      `  after ${ms / 1000}s: ${st.body.is_playing ? 'PLAYING' : 'paused'} · ${item?.uri === uri ? 'test song' : item?.name ?? 'other/none'} · ${Math.round(progress / 1000)}s · on ${device?.name ?? '?'} · vol ${device?.volume_percent ?? '?'}%`,
    )
    if (last !== null && item?.uri === uri) log(progress > last ? '  ✓ progress is moving' : '  ✗ progress is NOT moving')
    last = progress
  }
  await call('/me/player/pause', { method: 'PUT' })
  log('Paused the test song.')
}
