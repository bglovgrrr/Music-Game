import { ArrowRight, Loader2, LogIn, Sparkles, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AboutButton } from '@/components/about-card'
import { Logo } from '@/components/game-ui'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-safe pb-safe sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <AboutButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-md flex-1 content-center py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <Card className="rounded-[1.6rem] p-5 sm:p-7">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!onlineAvailable) demo()
                else run(joining ? 'join' : 'create')
              }}
              className="grid gap-4"
            >
              <label className="grid gap-2">
                <span className="text-sm font-medium">Your name</span>
                <Input
                  id="player-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Brian"
                  maxLength={24}
                  autoComplete="nickname"
                  enterKeyHint="go"
                />
              </label>

              {onlineAvailable ? (
                <>
                  {joining ? (
                    <div className="grid gap-3">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Room code</span>
                        <Input
                          id="room-code"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                          placeholder="ABCD"
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          inputMode="text"
                          className="text-center font-mono text-2xl tracking-[0.5em] uppercase placeholder:tracking-[0.5em]"
                        />
                      </label>
                      <Button type="submit" variant="brand" size="lg" disabled={!trimmed || !codeOk || !!busy}>
                        {busy === 'join' ? <Loader2 className="animate-spin" /> : <LogIn />} Join game
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setJoining(false)}>
                        Start a new game instead
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <Button type="submit" variant="brand" size="lg" disabled={!trimmed || !!busy}>
                        {busy === 'create' ? <Loader2 className="animate-spin" /> : <Sparkles />} Start a game
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/50 px-2 py-0.5 text-xs font-semibold text-ink/80 dark:bg-black/15">
                          2–8 <Users className="size-3.5" />
                        </span>
                      </Button>
                      <Button type="button" variant="outline" size="lg" onClick={() => setJoining(true)}>
                        <LogIn /> Join with a code
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button type="button" variant="ghost" onClick={demo} disabled={!trimmed}>
                    Try a demo with bot friends <ArrowRight />
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" variant="brand" size="lg" disabled={!trimmed}>
                    Play a demo game <ArrowRight />
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    You play with three bot friends on this device. Online rooms work in the real app, not in this preview.
                  </p>
                </>
              )}
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

