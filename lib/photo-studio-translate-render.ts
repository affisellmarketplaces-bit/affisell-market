import type { PhotoStudioTextSegment } from "@/lib/photo-studio-translate"

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function segmentsToMaskDataUrl(
  width: number,
  height: number,
  segments: PhotoStudioTextSegment[]
): string {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  ctx.fillStyle = "rgba(255, 0, 0, 0.85)"
  const pad = 0.012
  for (const seg of segments) {
    const x = ((seg.xPercent / 100) - pad) * width
    const y = ((seg.yPercent / 100) - pad) * height
    const w = (seg.widthPercent / 100 + pad * 2) * width
    const h = (seg.heightPercent / 100 + pad * 2) * height
    ctx.fillRect(Math.max(0, x), Math.max(0, y), Math.min(width - x, w), Math.min(height - y, h))
  }
  return canvas.toDataURL("image/png")
}

/** Reuse photo-studio local inpaint (imported dynamically in client). */
export type InpaintFn = (sourceUrl: string, maskUrl: string) => Promise<string>

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number
): number {
  let size = Math.max(10, Math.floor(maxHeight * 0.72))
  while (size >= 9) {
    ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
    const m = ctx.measureText(text)
    if (m.width <= maxWidth * 0.92 && size <= maxHeight * 0.85) return size
    size -= 1
  }
  return 9
}

function drawTranslatedLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segments: PhotoStudioTextSegment[]
): void {
  for (const seg of segments) {
    const x = (seg.xPercent / 100) * width
    const y = (seg.yPercent / 100) * height
    const w = (seg.widthPercent / 100) * width
    const h = (seg.heightPercent / 100) * height
    const text = seg.translated
    const fontSize = fitFontSize(ctx, text, w, h)
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = seg.textColor?.trim() || "#111827"
    ctx.shadowColor = "rgba(255,255,255,0.85)"
    ctx.shadowBlur = 3
    ctx.fillText(text, x + w / 2, y + h / 2, w * 0.92)
    ctx.shadowBlur = 0
  }
}

/**
 * Erase original text regions then draw translated copy for the buyer's locale.
 */
export async function renderTranslatedProductImage(
  sourceDataUrl: string,
  segments: PhotoStudioTextSegment[],
  inpaint: InpaintFn
): Promise<string> {
  if (segments.length === 0) return sourceDataUrl

  const img = await loadImage(sourceDataUrl)
  const width = img.naturalWidth
  const height = img.naturalHeight
  const maskUrl = segmentsToMaskDataUrl(width, height, segments)
  const cleaned = await inpaint(sourceDataUrl, maskUrl)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return cleaned
  const cleanedImg = await loadImage(cleaned)
  ctx.drawImage(cleanedImg, 0, 0)
  drawTranslatedLabels(ctx, width, height, segments)
  return canvas.toDataURL("image/jpeg", 0.93)
}
