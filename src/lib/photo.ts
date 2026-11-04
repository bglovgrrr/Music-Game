/** Load a photo for drawing. Falls back to an <img> on browsers without full createImageBitmap support (older iPhones). */
async function loadForDrawing(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() }
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  await img.decode()
  // <img> already applies the camera's rotation in modern browsers
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
}

/** Shrink a camera photo to at most `max` px on the long side, as JPEG (fixes rotation too). */
export async function compressPhoto(file: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  const pic = await loadForDrawing(file)
  const scale = Math.min(1, max / Math.max(pic.width, pic.height))
  const w = Math.round(pic.width * scale)
  const h = Math.round(pic.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(pic.source, 0, 0, w, h)
  pic.done()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the photo'))), 'image/jpeg', quality),
  )
}
