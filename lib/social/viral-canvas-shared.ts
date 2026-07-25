import type { ViralMedia } from "@/types/product"

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export async function loadViralImage(url: string): Promise<HTMLImageElement> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" })
    if (!res.ok) throw new Error(`http_${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await decodeImageElement(objectUrl)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return decodeImageElement(url, true)
  }
}

function decodeImageElement(url: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`image_load_failed:${url.slice(0, 80)}`))
    img.src = url
  })
}

export function coverDraw(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  cw: number,
  ch: number,
  scale: number
) {
  const base = Math.max(cw / sw, ch / sh) * scale
  const dw = sw * base
  const dh = sh * base
  const dx = (cw - dw) / 2
  const dy = (ch - dh) / 2
  ctx.drawImage(source, dx, dy, dw, dh)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length >= maxLines) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1] ?? ""
    lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : `${last}…`
  }
  return lines
}

export type BubbleStoryFrameInput = {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  image: CanvasImageSource
  imageWidth: number
  imageHeight: number
  title: string
  priceLabel: string
  /** Ken Burns scale (1 = fit, >1 = zoom). */
  scale: number
}

/**
 * Client canvas recreation of Affisell bubble Story (matches Satori vibe).
 * Client-safe: sale price only — never margin/cost.
 */
export function drawViralBubbleStoryFrame(input: BubbleStoryFrameInput): void {
  const { ctx, width: w, height: h, image, imageWidth, imageHeight, title, priceLabel, scale } = input

  const gradient = ctx.createLinearGradient(0, 0, w * 0.2, h)
  gradient.addColorStop(0, "#8b5cf6")
  gradient.addColorStop(0.55, "#0f172a")
  gradient.addColorStop(1, "#020617")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = "rgba(255,255,255,0.72)"
  ctx.font = `600 ${Math.max(11, Math.round(w * 0.032))}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("Sélection Affisell · Livraison 24/48h", w / 2, h * 0.075)

  const circleSize = Math.round(Math.min(w, h) * 0.42)
  const cx = w / 2
  const cy = h * 0.36
  const r = circleSize / 2

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(cx - r, cy - r)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, circleSize, circleSize)
  coverDraw(ctx, image, imageWidth, imageHeight, circleSize, circleSize, scale)
  ctx.restore()

  ctx.strokeStyle = "rgba(255,255,255,0.45)"
  ctx.lineWidth = Math.max(3, Math.round(circleSize * 0.035))
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Corner brackets (focus frame)
  const bracket = Math.round(circleSize * 0.14)
  const inset = Math.round(circleSize * 0.08)
  const left = cx - r - inset
  const top = cy - r - inset
  const right = cx + r + inset
  const bottom = cy + r + inset
  ctx.strokeStyle = "rgba(255,255,255,0.9)"
  ctx.lineWidth = Math.max(3, Math.round(w * 0.008))
  ctx.lineCap = "square"
  // TL
  ctx.beginPath()
  ctx.moveTo(left, top + bracket)
  ctx.lineTo(left, top)
  ctx.lineTo(left + bracket, top)
  ctx.stroke()
  // TR
  ctx.beginPath()
  ctx.moveTo(right - bracket, top)
  ctx.lineTo(right, top)
  ctx.lineTo(right, top + bracket)
  ctx.stroke()
  // BL
  ctx.beginPath()
  ctx.moveTo(left, bottom - bracket)
  ctx.lineTo(left, bottom)
  ctx.lineTo(left + bracket, bottom)
  ctx.stroke()
  // BR
  ctx.beginPath()
  ctx.moveTo(right - bracket, bottom)
  ctx.lineTo(right, bottom)
  ctx.lineTo(right, bottom - bracket)
  ctx.stroke()

  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${Math.max(14, Math.round(w * 0.048))}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  const lines = wrapLines(ctx, title, w * 0.82, 3)
  let ty = h * 0.58
  for (const line of lines) {
    ctx.fillText(line, w / 2, ty)
    ty += Math.round(w * 0.058)
  }

  const pillH = Math.round(h * 0.045)
  const priceW = Math.round(w * 0.22)
  const shipW = Math.round(w * 0.38)
  const gap = Math.round(w * 0.025)
  const totalW = priceW + gap + shipW
  const px = (w - totalW) / 2
  const py = Math.min(ty + Math.round(h * 0.03), h * 0.78)

  ctx.fillStyle = "rgba(24,24,27,0.85)"
  roundRect(ctx, px, py, priceW, pillH, pillH / 2)
  ctx.fill()
  ctx.fillStyle = "#38bdf8"
  roundRect(ctx, px + priceW + gap, py, shipW, pillH, pillH / 2)
  ctx.fill()

  ctx.fillStyle = "#ffffff"
  ctx.font = `700 ${Math.max(11, Math.round(w * 0.032))}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(priceLabel, px + priceW / 2, py + pillH / 2)
  ctx.fillText("Livraison 24/48h", px + priceW + gap + shipW / 2, py + pillH / 2)

  ctx.fillStyle = "rgba(255,255,255,0.8)"
  ctx.font = `600 ${Math.max(11, Math.round(w * 0.03))}px system-ui, -apple-system, sans-serif`
  ctx.fillText("Voir le produit → Affisell", w / 2, h * 0.9)

  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.font = `700 ${Math.max(10, Math.round(w * 0.028))}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = "right"
  ctx.fillText("Affisell", w * 0.92, h * 0.955)
}

/** Prefer still images for GIF (video frames explode size / palette). */
export function pickGifMedias(medias: ViralMedia[], max = 5): ViralMedia[] {
  const images = medias.filter((m) => m.type === "image" && m.url)
  if (images.length > 0) return images.slice(0, max)
  return medias.filter((m) => m.url).slice(0, 1)
}
