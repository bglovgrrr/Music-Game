/**
 * The host's Spotify "session": the little bits of shared state that keep music working on
 * a phone. Everything else (API calls, playing, pausing) lives in spotify-player.ts.
 *
 * Phone Spotify, as the game sees it (iPhone hosts):
 *
 *   unknown ──(device list checked)──▶ awake ◀──(came back from Spotify)── asleep
 *                                        │                                   ▲
 *                                        └──(not on the device list / "no active device")──┘
 *
 * - awake:  Spotify is on the account's device list. The keep-alive device is set and plays
 *           looping silence between songs so iOS doesn't suspend it.
 * - asleep: Spotify isn't running. Only a tap can open it (wakeSpotify); coming back within
 *           3 minutes counts as "just woke" and the song starts by itself.
 * - unknown: not an iPhone host, Spotify not connected, or not checked yet.
 */

let keepAliveId: string | null = null
/** The phone being kept awake (plays silence between songs), or null. Set by the keep-alive. */
export const keepAliveDevice = () => keepAliveId
export const setKeepAliveDevice = (id: string | null) => {
  keepAliveId = id
}

/**
 * Is Spotify reachable on this phone? 'asleep' = this is an iPhone host and Spotify isn't
 * running (it isn't on the account's device list), so nothing can play until it's opened.
 */
export type PhoneSpotify = 'unknown' | 'awake' | 'asleep'
let phoneState: PhoneSpotify = 'unknown'
const phoneListeners = new Set<() => void>()
export const phoneSpotify = () => phoneState
export function setPhoneSpotify(next: PhoneSpotify) {
  if (next === phoneState) return
  phoneState = next
  phoneListeners.forEach((l) => l())
}
export function onPhoneSpotify(l: () => void) {
  phoneListeners.add(l)
  return () => phoneListeners.delete(l)
}

let wokeAt = 0
/** Open the Spotify app (must run inside a tap). Coming back soon after counts as "just woken". */
export function wakeSpotify() {
  wokeAt = Date.now()
  window.location.href = 'spotify:'
}
export const justWoke = () => Date.now() - wokeAt < 3 * 60_000
export const clearWoke = () => {
  wokeAt = 0
}
