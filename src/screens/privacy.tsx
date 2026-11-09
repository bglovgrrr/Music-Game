import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Plain-language privacy page (/privacy). Keep it in step with the database and retention job. */
export function PrivacyScreen({ onDone }: { onDone: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-safe pb-safe">
      <header className="flex h-14 items-center">
        <Button variant="ghost" size="sm" onClick={onDone}>
          <ArrowLeft /> Back
        </Button>
      </header>
      <article className="paper paper-texture on-table grid gap-4 rounded-[4px] bg-[var(--paper)] px-5 py-6 text-[0.95rem] leading-relaxed">
        <h1 className="text-3xl leading-none font-bold font-soft">Privacy</h1>
        <p className="font-note text-lg text-muted-foreground italic">
          The short version: no accounts, no ads, no tracking, and games disappear after 30 days.
        </p>

        <Section title="What we keep">
          <li>A random player ID for your phone (no account, no email).</li>
          <li>The name you type, the questions, the songs you pick, your “why I picked it” notes, votes, guesses and reactions, for the game you’re in.</li>
          <li>Group selfies, if you take one. Only the players in that game can see them.</li>
        </Section>

        <Section title="How long">
          <li>Games, notes and selfies are deleted automatically 30 days after the game started.</li>
          <li>
            If you share a mixtape link, a copy of the songs and first names (no selfies, no notes) is kept for a year so the link keeps working. Anyone with
            the link can see it.
          </li>
          <li>Error reports (what broke, the app version and the browser type, never names or songs) stay in our hosting logs for a short time.</li>
        </Section>

        <Section title="Spotify">
          <li>
            If the host connects Spotify, the sign-in stays on their phone. We use it only to search, play the game’s songs and save a playlist when asked.
          </li>
          <li>We don’t store anyone’s listening history.</li>
        </Section>

        <Section title="What we don’t do">
          <li>No ads, no analytics or tracking cookies, and we never sell or share data.</li>
        </Section>

        <Section title="Questions or deleting a game early">
          <li>
            Open an issue at{' '}
            <a className="font-semibold text-[#a0560b] underline" href="https://github.com/bglovgrrr/Music-Game/issues" target="_blank" rel="noreferrer">
              github.com/bglovgrrr/Music-Game
            </a>{' '}
            with the game’s room code.
          </li>
        </Section>
        <p className="text-xs text-muted-foreground">Mixtape Memories is run by Supabase (data) and Vercel (hosting).</p>
      </article>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h2 className="font-display text-lg leading-none font-bold [font-stretch:80%]">{title}</h2>
      <ul className="grid list-disc gap-1 pl-5">{children}</ul>
    </section>
  )
}
