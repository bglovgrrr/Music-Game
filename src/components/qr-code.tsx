import { useMemo } from 'react'
import { encode } from 'uqr'
import { cn } from '@/lib/utils'

/** Scannable QR code. Always dark-on-white (scanners need the contrast), on a soft card. */
export function QrCode({ value, className }: { value: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 })
    let d = ''
    qr.data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x},${y}h1v1h-1z`)))
    return { size: qr.size, path: d }
  }, [value])

  return (
    <div className={cn('paper paper-texture on-table rotate-[1.5deg] rounded-[4px] bg-[var(--paper)] p-3', className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="block size-full" shapeRendering="crispEdges" role="img" aria-label="QR code to join this game">
        <path d={path} fill="#1e140f" />
      </svg>
    </div>
  )
}
