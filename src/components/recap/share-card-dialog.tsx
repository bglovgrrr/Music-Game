import { Link2, Loader2, Share, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { canShareWrap, shareWrap } from '@/lib/wrap'
import { useGame } from '@/hooks/use-game'

/**
 * The recap card. Online games share a link (/w/<id>) that unfurls in chats with this card
 * as its preview and opens a read-only wrap of the night. Demo games share the image.
 */
export function RecapCardDialog({ onClose }: { onClose: () => void }) {
  const { state, client } = useGame()
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const linkable = canShareWrap(client)

  useEffect(() => {
    let objectUrl: string | null = null
    const latest = [...state.rounds].reverse().find((r) => r.photo)?.photo
    ;(latest ? client.photoUrl(latest.path).catch(() => null) : Promise.resolve(null))
      .then(async (photoUrl) => (await import('@/lib/recap-card')).drawRecapCard(state, photoUrl))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setFile(new File([blob], 'mixtape-memories.png', { type: 'image/png' }))
        setUrl(objectUrl)
      })
      .catch(() => toast.error('Could not make the image'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [state, client])

  const title = 'Our Mixtape Memories mixtape'
  const shareLink = async () => {
    setBusy(true)
    try {
      // The public preview never includes selfies: draw a clean card for it.
      const href = link ?? (await shareWrap(client, state, await (await import('@/lib/recap-card')).drawRecapCard(state, null)))
      setLink(href)
      if (navigator.share) await navigator.share({ title, text: 'Here’s our mixtape from tonight 🎶', url: href })
      else {
        await navigator.clipboard.writeText(href)
        toast.success('Link copied')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error((err as Error).message || 'Could not share')
    } finally {
      setBusy(false)
    }
  }

  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  const shareImage = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Could not share')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recap card"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="paper paper-texture grid w-full max-w-sm gap-3 rounded-[4px] bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-soft">Your recap card</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="grid aspect-[4/5] max-h-[52dvh] place-items-center justify-self-center overflow-hidden rounded-[4px] bg-muted">
          {url ? (
            <img src={url} alt="Recap card of tonight's mixtape" className="size-full object-contain" />
          ) : (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          )}
        </div>
        {linkable ? (
          <>
            <Button variant="brand" size="lg" onClick={shareLink} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Share the mixtape link
            </Button>
            <p className="text-center text-xs text-muted-foreground">Opens a page with every song (no selfies or notes). Anyone with the link can see it.</p>
            {canShareFile && (
              <Button variant="ghost" size="sm" onClick={shareImage}>
                <Share /> Share the image instead
              </Button>
            )}
          </>
        ) : canShareFile ? (
          <Button variant="brand" size="lg" onClick={shareImage}>
            <Share /> Share
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Press and hold the image to save or share it.</p>
        )}
      </motion.div>
    </motion.div>
  )
}
