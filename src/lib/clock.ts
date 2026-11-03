/**
 * Shared clock. Online, each phone's clock is nudged to match the server's,
 * so play/pause positions line up across devices. In demo mode the offset is 0.
 */
let offsetMs = 0

export const clock = {
  now: () => Date.now() + offsetMs,
  setOffset(ms: number) {
    offsetMs = Number.isFinite(ms) ? ms : 0
  },
}
