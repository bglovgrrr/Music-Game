import { ArrowRight, Loader2, LogIn, Sparkles, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AboutButton } from '@/components/about-card'
import { Cassette } from '@/components/cassette'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { onlineAvailable } from '@/lib/supabase'
import { safeStorage } from '@/lib/utils'


/** Code from an invite link like https://…/?join=ABCD */
function inviteCode() {
  try {
    return new URLSearchParams(window.location.search).get('join')?.toUpperCase().slice(0, 4) ?? ''
  } catch {
    return ''
  }
}

export function HomeScreen({
  onDemo,
  onCreate,
  onJoin,
}: {
  onDemo: (name: string) => void
  onCreate: (name: string) => Promise<void>
  onJoin: (code: string, name: string) => Promise<void>
}) {
  const [name, setName] = useState(() => safeStorage.get('sideb:name') ?? '')
  const [code, setCode] = useState(inviteCode)
  const [joining, setJoining] = useState(() => inviteCode() !== '')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const trimmed = name.trim()
  const codeOk = /^[A-Z]{4}$/.test(code)

  // Opened from an invite link: bring the join form into view.
  useEffect(() => {
    if (!inviteCode()) return
    const t = setTimeout(() => document.getElementById('player-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
    return () => clearTimeout(t)
  }, [])

  const remember = () => safeStorage.set('sideb:name', trimmed)

  const run = async (kind: 'create' | 'join') => {
    if (!trimmed || busy) return
    if (kind === 'join' && !codeOk) return
    remember()
    setBusy(kind)
    try {
      if (kind === 'create') await onCreate(trimmed)
      else await onJoin(code, trimmed)
    } finally {
      setBusy(null)
    }
  }

  const demo = () => {
    if (!trimmed) return
    remember()
    onDemo(trimmed)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-safe sm:px-8">
      <header className="flex h-16 items-center justify-end">
        <div className="flex items-center gap-1">
          <AboutButton />
          <ThemeToggle />
        </div>
      </header>

      {/* The tape on the table: pick it up and turn it. */}
      <div className="grid flex-1 place-items-center py-6">
        <motion.div initial={{ opacity: 0, y: 16, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: 0.6 }} className="w-full max-w-[22rem]">
          <Cassette />
        </motion.div>
      </div>

      {/* A torn sheet of paper at the bottom of the screen */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 24 }}
        className="-mx-4 drop-shadow-[0_-1px_2px_rgb(0_0_0/0.35)] sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="paper paper-texture torn-top bg-[var(--paper)] px-6 pt-8 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!onlineAvailable) demo()
              else run(joining ? 'join' : 'create')
            }}
            className="grid gap-4"
          >
            <div className="sketch">
              <input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                maxLength={24}
                autoComplete="nickname"
                enterKeyHint="go"
                className="h-13 w-full bg-transparent px-4 font-note text-2xl italic outline-none placeholder:text-[#2a1e18]/45"
              />
            </div>

            {onlineAvailable ? (
              <>
                {joining ? (
                  <div className="grid gap-4">
                    <div className="sketch">
                      <input
                        id="room-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                        placeholder="CODE"
                        aria-label="Room code"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        inputMode="text"
                        className="h-13 w-full bg-transparent px-4 text-center font-mono text-2xl tracking-[0.5em] uppercase outline-none placeholder:text-[#2a1e18]/35"
                      />
                    </div>
                    <Button type="submit" variant="sketch-fill" size="lg" disabled={!trimmed || !codeOk || !!busy}>
                      {busy === 'join' ? <Loader2 className="animate-spin" /> : <LogIn />} Join the mixtape
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setJoining(false)}>
                      Start a new one instead
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <Button type="submit" variant="sketch-fill" size="lg" disabled={!trimmed || !!busy}>
                      {busy === 'create' ? <Loader2 className="animate-spin" /> : <Sparkles />} Start a mixtape
                      <span className="ml-1 inline-flex items-center gap-1 font-mono text-xs opacity-70">
                        2–8 <Users className="size-3.5" />
                      </span>
                    </Button>
                    <Button type="button" variant="sketch" size="lg" onClick={() => setJoining(true)}>
                      <LogIn /> Join with a code
                    </Button>
                  </div>
                )}
                <Button type="button" variant="link" className="text-muted-foreground" onClick={demo} disabled={!trimmed}>
                  or try a demo with bot friends <ArrowRight />
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" variant="sketch-fill" size="lg" disabled={!trimmed}>
                  Play a demo game <ArrowRight />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  You play with three bot friends on this device. Online rooms work in the real app, not in this preview.
                </p>
              </>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  )
}
