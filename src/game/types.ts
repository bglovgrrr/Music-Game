export type Track = {
  id: string
  title: string
  artist: string
  album?: string
  artwork?: string
  /** 30s preview clip (iTunes). Full playback comes later via Spotify. */
  previewUrl?: string
  /** Length of what we can actually play, in ms. */
  durationMs: number
  externalUrl?: string
  source: 'itunes' | 'demo' | 'spotify'
  /** Used to draw a gradient cover when there is no artwork. */
  hue?: number
}

export type Player = {
  id: string
  name: string
  color: string
  isBot?: boolean
}

export type Pick = {
  playerId: string
  track: Track
  /** Optional "why I picked it", revealed when the song plays. */
  note?: string
  pickedAt: number
}

export type Round = {
  id: string
  number: number
  askerId: string
  prompt: string
  themeId?: string
  picks: Pick[]
  /** Player ids in play order (only players who picked). */
  order: string[]
  /** Index into `order` of the song that is up now. */
  current: number
  startedAt: number
  /** When picking closes automatically (pick timer). */
  pickDeadline?: number
  /** "Guess who picked it" was on for this round. */
  guessMode?: boolean
  /** guesses[songOwnerId][guesserId] = the player they guessed. */
  guesses?: Record<string, Record<string, string>>
  /** Owners whose song has been revealed (guess mode). */
  revealed?: string[]
  /** Song of the round: votes[voterId] = song owner they voted for. */
  votes?: Record<string, string>
  /** Group selfie taken after this round. */
  photo?: Photo
}

export type Photo = {
  /** Storage path (online) or a local object URL (demo). */
  path: string
  by: string
  takenAt: number
}

export type Settings = {
  /** Everyone guesses who picked each song before it's revealed. */
  guessMode: boolean
  /** Seconds to pick a song, or null for no timer. */
  pickSeconds: number | null
}

export type Phase = 'lobby' | 'asking' | 'picking' | 'listening' | 'between' | 'recap'

/** Shared playback state. Position is `positionMs` at time `updatedAt`. */
export type Playback = {
  isPlaying: boolean
  positionMs: number
  updatedAt: number
}

export type GameState = {
  id: string
  code: string
  hostId: string
  phase: Phase
  players: Player[]
  rounds: Round[]
  /** Whose turn it is to ask: index into `players`. */
  turn: number
  playback: Playback
  createdAt: number
  /** Missing on older games; see settingsOf(). */
  settings?: Settings
}

export type Action =
  | { type: 'join'; player: Player }
  | { type: 'leave'; playerId: string }
  | { type: 'start' }
  | { type: 'ask'; prompt: string; themeId?: string }
  | { type: 'pick'; track: Track; note?: string }
  | { type: 'unpick' }
  | { type: 'startListening' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; positionMs: number }
  /**
   * `from` is the song index the tap was meant for. If two people tap at once,
   * the second tap no longer matches and is ignored (no double skip).
   */
  | { type: 'next'; from?: number }
  | { type: 'prev'; from?: number }
  | { type: 'jump'; index: number }
  | { type: 'trackEnded' }
  | { type: 'nextRound' }
  | { type: 'end' }
  | { type: 'settings'; settings: Partial<Settings> }
  /** Guess who picked `owner`'s song. */
  | { type: 'guess'; owner: string; guessed: string }
  | { type: 'reveal'; owner: string }
  /** Vote for the song of the round. */
  | { type: 'vote'; owner: string }
  /** Attach a group selfie to a round (replaces any earlier one). */
  | { type: 'photo'; roundId: string; path: string }
  | { type: 'removePhoto'; roundId: string }
