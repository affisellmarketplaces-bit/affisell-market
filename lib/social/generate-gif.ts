import { GIFEncoder, quantize, applyPalette } from "gifenc"

import type { ViralMedia } from "@/types/product"
import {
  drawViralBubbleStoryFrame,
  easeInOutCubic,
  loadViralImage,
  pickGifMedias,
} from "@/lib/social/viral-canvas-shared"

export type ViralGifExportOptions = {
  medias: ViralMedia[]
  title: string
  salePrice: number
  /** WhatsApp-optimized default 540×960 (half of Story). */
  width?: number
  height?: number
  fps?: number
  imageHoldMs?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

export type ViralGifExportResult = {
  blob: Blob
  mimeType: "image/gif"
  ext: "gif"
  bytes: number
  frames: number
  width: number
  height: number
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("aborted")
}

export function sniffGifContainer(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false
  const header = String.fromCharCode(...bytes.slice(0, 6))
  return header === "GIF87a" || header === "GIF89a"
}

/**
 * Animated Affisell bubble GIF — WhatsApp / Telegram / email autoplay.
 * Complements PNG (still) + MP4 (TikTok). Client-safe price only.
 */
export async function recordViralBubbleGif(
  options: ViralGifExportOptions
): Promise<ViralGifExportResult> {
  const medias = pickGifMedias(options.medias)
  if (medias.length === 0) throw new Error("no_medias")

  const width = options.width ?? 540
  const height = options.height ?? 960
  const fps = Math.min(12, Math.max(6, options.fps ?? 10))
  const imageHoldMs = options.imageHoldMs ?? 1100
  const delayCs = Math.max(4, Math.round(100 / fps))
  const priceLabel = `${options.salePrice.toFixed(0)}€`

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })
  if (!ctx) throw new Error("canvas_unavailable")

  const gif = GIFEncoder()
  let frameCount = 0

  const totalEstimate =
    medias.reduce((acc, m) => {
      const hold = m.duration ?? imageHoldMs
      return acc + Math.max(4, Math.round((hold / 1000) * fps))
    }, 0) || 1

  for (let mi = 0; mi < medias.length; mi++) {
    assertNotAborted(options.signal)
    const media = medias[mi]!
    const img = await loadViralImage(media.url)
    const hold = media.duration ?? imageHoldMs
    const frames = Math.max(4, Math.round((hold / 1000) * fps))

    for (let f = 0; f < frames; f++) {
      assertNotAborted(options.signal)
      const t = frames <= 1 ? 0 : easeInOutCubic(f / (frames - 1))
      const scale = 1.12 - t * 0.12

      drawViralBubbleStoryFrame({
        ctx,
        width,
        height,
        image: img,
        imageWidth: img.naturalWidth || img.width,
        imageHeight: img.naturalHeight || img.height,
        title: options.title,
        priceLabel,
        scale,
      })

      const rgba = ctx.getImageData(0, 0, width, height).data
      const palette = quantize(rgba, 128)
      const index = applyPalette(rgba, palette)
      gif.writeFrame(index, width, height, {
        palette,
        delay: delayCs,
        repeat: 0,
      })
      frameCount++
      options.onProgress?.(Math.min(0.99, frameCount / totalEstimate))
      // Yield so UI stays responsive during encode
      if (frameCount % 3 === 0) {
        await new Promise((r) => window.setTimeout(r, 0))
      }
    }
  }

  gif.finish()
  const raw = gif.bytes()
  if (!sniffGifContainer(raw)) {
    throw new Error("invalid_gif_container")
  }

  const copy = new Uint8Array(raw.byteLength)
  copy.set(raw)
  const blob = new Blob([copy], { type: "image/gif" })
  options.onProgress?.(1)
  console.log("[viral-gif]", {
    event: "recorded",
    bytes: blob.size,
    frames: frameCount,
    width,
    height,
    mediaCount: medias.length,
  })

  return {
    blob,
    mimeType: "image/gif",
    ext: "gif",
    bytes: blob.size,
    frames: frameCount,
    width,
    height,
  }
}

export function downloadViralGifBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".gif") ? filename : `${filename}.gif`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function previewViralGifBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}
