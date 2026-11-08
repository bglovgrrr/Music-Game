import { useEffect, useRef } from 'react'
import { useGame } from '@/hooks/use-game'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { logSpotify } from '@/music/spotify-log'
import {
  chooseDevice,
  chosenDeviceId,
  getPlayback,
  isSilence,
  listDevices,
  LOCAL,
  localPlayerUsable,
  needsKeepAlive,
  isIOS,
  keepAliveTarget,
  playSilence,
  setKeepAliveDevice,
  setPhoneSpotify,
} from '@/music/spotify-player'

/**
 * Host only. When the music plays on a phone's Spotify app, iOS puts that app to sleep
 * once it's paused. So whenever no song is playing, keep Spotify busy with silence.
 * Silence plays on repeat, so Spotify stays awake even while the host's phone is locked.
 * Checks every 20s and whenever the host comes back to Mixtape Memories.
 */
export function SpotifyKeepAlive() {
  const { state, client } = useGame()
  const connected = useSpotifyConnected()
  const songPlaying = useRef(false)
  const playingNow = state.phase === 'listening' && state.playback.isPlaying
  useEffect(() => {
    songPlaying.current = playingNow
  }, [playingNow])

  useEffect(() => {
    if (!connected || !client.isSpeaker) {
      setKeepAliveDevice(null)
      setPhoneSpotify('unknown')
      return
    }
    let busy = false
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        const devices = await listDevices().catch(() => [])
        const picked = chosenDeviceId()
        // The remembered device, or (no built-in player here, e.g. iPhone) this phone's Spotify,
        // also when the remembered device is stale. Without that the silence never played and
        // iOS put Spotify to sleep while people were picking songs.
        const target = keepAliveTarget(devices, picked, localPlayerUsable())
        if (target && target.id !== picked) {
          chooseDevice(target.id)
          logSpotify(`keep-alive: using ${target.name}${picked && picked !== LOCAL ? ' (the remembered device is gone)' : ''}`)
        }
        const phone = target && needsKeepAlive(target) ? target : null
        setKeepAliveDevice(phone?.id ?? null)
        if (isIOS() && !localPlayerUsable()) setPhoneSpotify(devices.some(needsKeepAlive) ? 'awake' : 'asleep')
        if (!phone || songPlaying.current) return
        const pb = await getPlayback().catch(() => null)
        if (pb?.isPlaying && pb.deviceId === phone.id) return // already awake (silence or music)
        await playSilence()
        logSpotify(`keep-alive: playing silence on ${phone.name}${pb && !isSilence(pb) ? '' : ''}`)
      } catch (err) {
        logSpotify(`keep-alive: ${(err as Error).message}`)
      } finally {
        busy = false
      }
    }
    void tick()
    const timer = setInterval(tick, 20_000)
    const onVisible = () => document.visibilityState === 'visible' && void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      setKeepAliveDevice(null)
    }
  }, [connected, client.isSpeaker])

  return null
}
