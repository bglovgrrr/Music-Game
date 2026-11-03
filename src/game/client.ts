import type { Action, GameState } from './types'

export const REACTIONS = ['❤️', '😂', '😭', '🔥', '🙌'] as const

/** A quick emoji tap while a song plays. Not saved; it just floats up on every screen. */
export type Reaction = { id: string; emoji: string; playerId: string }

/**
 * How the UI talks to a game. Demo mode runs everything on this device with bots;
 * online mode (next step: Supabase) will sync the same state between phones.
 */
export interface GameClient {
  readonly mode: 'demo' | 'online'
  readonly meId: string
  /** True when this device plays the audio (the one hooked up to the speaker). */
  readonly isSpeaker: boolean
  getState(): GameState
  subscribe(listener: () => void): () => void
  dispatch(action: Action): void
  react(emoji: string): void
  /** Store a group selfie; returns the path to save in the round. */
  uploadPhoto(image: Blob): Promise<string>
  /** A URL the browser can show for a stored photo (signed and short-lived online). */
  photoUrl(path: string): Promise<string>
  deletePhoto(path: string): Promise<void>
  onReaction(listener: (r: Reaction) => void): () => void
  dispose(): void
}
