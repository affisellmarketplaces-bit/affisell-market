"use client"

const MAX_SIDE = 768
const JPEG_QUALITY = 0.82

/** Downscale + JPEG-compress a picked image file into a data URL small enough to send to a vision model. */
export async function compressImageFileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")
    ctx.drawImage(bmp, 0, 0, w, h)
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  } finally {
    bmp.close?.()
  }
}
