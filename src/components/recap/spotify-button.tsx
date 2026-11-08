import { ExternalLink, ListMusic, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { saveToSpotify, spotifyAvailable, type ExportResult } from '@/music/spotify'
import { useGame } from '@/hooks/use-game'

/** "Save to Spotify" with progress, the playlist link, and clear errors. */
export function SpotifyButton() {
  const { state } = useGame()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)

  if (!spotifyAvailable) {
    return (
      <Button variant="outline" disabled>
        <ListMusic /> Save to Spotify <Badge variant="secondary">Soon</Badge>
      </Button>
    )
  }
  if (result) {
    return (
      <Button variant="outline" asChild>
        <a href={result.url} target="_blank" rel="noreferrer">
          <ExternalLink /> Open playlist ({result.added} songs)
        </a>
      </Button>
    )
  }

  const save = async () => {
    const tracks = state.rounds.flatMap((r) => r.order.map((pid) => r.picks.find((p) => p.playerId === pid)!.track))
    const date = new Date(state.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const prompts = state.rounds.filter((r) => r.order.length).map((r) => r.prompt)
    try {
      const res = await saveToSpotify(`Mixtape Memories · ${date}`, `Our Mixtape Memories mixtape: ${prompts.join(' / ')}`.slice(0, 300), tracks, setBusy)
      setResult(res)
      toast.success('Playlist saved to Spotify', {
        description: res.missing.length ? `${res.missing.length} song${res.missing.length > 1 ? 's' : ''} couldn't be found on Spotify.` : undefined,
      })
    } catch (err) {
      toast.error((err as Error).message || 'Could not save to Spotify')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Button variant="outline" onClick={save} disabled={!!busy}>
      {busy ? <Loader2 className="animate-spin" /> : <ListMusic />} {busy ?? 'Save to Spotify'}
    </Button>
  )
}
