import { Camera, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { playerById } from '@/game/engine'
import type { Photo, Round } from '@/game/types'
import { useGame } from '@/hooks/use-game'
import { compressPhoto } from '@/lib/photo'
import { cn } from '@/lib/utils'

/** Resolves a stored photo to something an <img> can show. */
export function usePhotoUrl(photo?: Photo) {
  const { client } = useGame()
  const [url, setUrl] = useState<string | null>(null)
  const path = photo?.path
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!path) return
    client
      .photoUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null))
    return () => {
      cancelled = true
    }
  }, [client, path])
  return url
}

/** A photo styled like a polaroid, slightly tilted. */
export function Polaroid({ photo, caption, tilt = -2.5, className }: { photo: Photo; caption?: string; tilt?: number; className?: string }) {
  const url = usePhotoUrl(photo)
  return (
    <motion.figure
      initial={{ opacity: 0, rotate: tilt * 3, y: 10 }}
      animate={{ opacity: 1, rotate: tilt, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className={cn('rounded-md bg-white p-2.5 pb-3 text-ink shadow-[0_14px_30px_-12px_rgb(30_20_60/0.45)]', className)}
    >
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-sm bg-[#eceaf2]">
        {url ? <img src={url} alt={caption ?? 'Group selfie'} className="size-full object-cover" /> : <Loader2 className="size-5 animate-spin text-[#8a86a0]" />}
      </div>
      {caption && <figcaption className="mt-2 line-clamp-2 text-center font-display text-sm italic">{caption}</figcaption>}
    </motion.figure>
  )
}

/** Take (or retake / remove) the group selfie for a round. */
export function SelfieCard({ round, className }: { round: Round; className?: string }) {
  const { client, dispatch, state, meId } = useGame()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const photo = round.photo
  const by = photo && playerById(state, photo.by)

  const onFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    const previous = round.photo?.path
    try {
      const image = await compressPhoto(file)
      const path = await client.uploadPhoto(image)
      dispatch({ type: 'photo', roundId: round.id, path })
      if (previous) void client.deletePhoto(previous).catch(() => {})
      toast.success('Selfie saved with this game')
    } catch (err) {
      toast.error((err as Error).message || 'Could not save the photo')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = () => {
    if (!photo) return
    dispatch({ type: 'removePhoto', roundId: round.id })
    void client.deletePhoto(photo.path).catch(() => {})
  }

  return (
    <div className={cn('grid gap-3', className)}>
      {/* `capture="user"` opens the front camera on phones; desktops get a file picker. */}
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {photo ? (
        <>
          <Polaroid photo={photo} caption={round.prompt} className="mx-auto w-full max-w-xs" />
          <p className="text-center text-xs text-muted-foreground">Taken by {by?.id === meId ? 'you' : (by?.name ?? 'someone')}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Retake
            </Button>
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
              <Trash2 /> Remove
            </Button>
          </div>
        </>
      ) : (
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="grid cursor-pointer justify-items-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition hover:border-ring/60 hover:bg-muted/50 disabled:cursor-wait"
        >
          <span className="grid size-12 place-items-center rounded-full bg-[var(--pastel-2)] text-ink">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </span>
          <span className="font-semibold">{busy ? 'Saving…' : 'Take a group selfie'}</span>
          <span className="text-xs text-muted-foreground">Squeeze in! It's saved with this game{client.mode === 'demo' ? ' (on this device only in the demo)' : ''}.</span>
        </button>
      )}
    </div>
  )
}
