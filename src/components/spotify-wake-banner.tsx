import { Music2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { useGame } from '@/hooks/use-game'
import { onPhoneSpotify, phoneSpotify, wakeSpotify } from '@/music/spotify-player'

/**
 * Host on an iPhone, Spotify not running: nothing can play until it's opened (a web page
 * can't start it). Say so up front, with a one-tap fix, in the lobby and during the game.
 */
export function SpotifyWakeBanner() {
  const { client, state: game } = useGame()
  const state = useSyncExternalStore(onPhoneSpotify, phoneSpotify, phoneSpotify)
  // In the lobby the music setup card covers this.
  const show = client.isSpeaker && state === 'asleep' && game.phase !== 'lobby'
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="shrink-0 overflow-hidden"
        >
          <div className="paper paper-texture on-table mb-2 flex items-center gap-3 rounded-[4px] bg-[var(--paper)] px-3 py-2">
            <Music2 className="size-5 shrink-0 text-[#a0560b]" />
            <p className="min-w-0 flex-1 text-sm leading-snug">
              <span className="font-semibold">Spotify isn’t open on this phone.</span>{' '}
              <span className="text-muted-foreground">Open it once, then come right back.</span>
            </p>
            <Button variant="sketch-fill" size="sm" onClick={wakeSpotify}>
              Open Spotify
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
