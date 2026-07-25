import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeVideo,
  getFirstEncodableVideoCodec,
} from "mediabunny"

import type { ViralMedia } from "@/types/product"
import { sniffVideoContainer } from "@/lib/social/video-container-sniff"

export type ViralVideoExportOptions = {
  medias: ViralMedia[]
  width?: number
  height?: number
  fps?: number
  /** Hold duration per image when `duration` omitted (ms). */
  imageHoldMs?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

export type ViralVideoExportResult = {
  blob: Blob
  mimeType: string
  ext: "mp4"
  bytes: number
  codec: string
}

export { sniffVideoContainer } from "@/lib/social/video-container-sniff"

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("aborted")
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  // Prefer fetch→blob so we control CORS and avoid tainted canvas when CDN allows it.
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

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    video.src = url
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error(`video_load_failed:${url.slice(0, 80)}`))
  })
}

function coverDraw(
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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Viral Reel export — real H.264/AVC MP4 via WebCodecs + Mediabunny (Fast Start).
 * QuickTime / TikTok / Instagram compatible. Never labels WebM as `.mp4`.
 */
export async function recordViralCarouselVideo(
  options: ViralVideoExportOptions
): Promise<ViralVideoExportResult> {
  const medias = options.medias.filter((m) => Boolean(m.url))
  if (medias.length === 0) throw new Error("no_medias")

  const width = options.width ?? 1080
  const height = options.height ?? 1920
  const fps = options.fps ?? 30
  const imageHoldMs = options.imageHoldMs ?? 1400
  const frameDuration = 1 / fps

  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error("odd_dimensions")
  }

  const codec =
    (await getFirstEncodableVideoCodec(["avc"], {
      width,
      height,
      bitrate: QUALITY_HIGH,
    })) ?? null

  if (!codec || !(await canEncodeVideo(codec, { width, height, bitrate: QUALITY_HIGH }))) {
    throw new Error("h264_unavailable")
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) throw new Error("canvas_unavailable")

  const target = new BufferTarget()
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  })

  const videoSource = new CanvasSource(canvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 1,
    sizeChangeBehavior: "deny",
  })
  output.addVideoTrack(videoSource, { frameRate: fps })
  await output.start()

  const totalFrames =
    medias.reduce((acc, m) => {
      if (m.type === "video") {
        return acc + Math.max(1, Math.round(((m.duration ?? 3000) / 1000) * fps))
      }
      return acc + Math.max(1, Math.round(((m.duration ?? imageHoldMs) / 1000) * fps))
    }, 0) || 1

  let frameIndex = 0

  const pushFrame = async () => {
    assertNotAborted(options.signal)
    const timestamp = frameIndex * frameDuration
    await videoSource.add(timestamp, frameDuration)
    frameIndex++
    options.onProgress?.(Math.min(0.99, frameIndex / totalFrames))
  }

  try {
    for (const media of medias) {
      assertNotAborted(options.signal)

      if (media.type === "image") {
        const img = await loadImage(media.url)
        const hold = media.duration ?? imageHoldMs
        const frames = Math.max(1, Math.round((hold / 1000) * fps))
        for (let f = 0; f < frames; f++) {
          const t = frames <= 1 ? 0 : easeInOutCubic(f / (frames - 1))
          const scale = 1.1 - t * 0.1
          ctx.fillStyle = "#0b1220"
          ctx.fillRect(0, 0, width, height)
          coverDraw(
            ctx,
            img,
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            width,
            height,
            scale
          )
          await pushFrame()
        }
      } else {
        const video = await loadVideo(media.url)
        await video.play().catch(() => undefined)
        const holdMs = media.duration ?? Math.min(4000, Math.max(1500, (video.duration || 3) * 1000))
        const frames = Math.max(1, Math.round((holdMs / 1000) * fps))
        for (let f = 0; f < frames; f++) {
          ctx.fillStyle = "#0b1220"
          ctx.fillRect(0, 0, width, height)
          if (video.videoWidth > 0) {
            coverDraw(ctx, video, video.videoWidth, video.videoHeight, width, height, 1)
          }
          await pushFrame()
        }
        video.pause()
        video.removeAttribute("src")
        video.load()
      }
    }

    await output.finalize()
  } catch (err) {
    await output.cancel().catch(() => undefined)
    throw err
  }

  const buffer = target.buffer
  if (!buffer || buffer.byteLength < 32) {
    throw new Error("empty_mp4")
  }

  const bytes = new Uint8Array(buffer)
  const container = sniffVideoContainer(bytes)
  if (container !== "mp4") {
    console.error("[viral-video]", { event: "invalid_container", container, bytes: bytes.byteLength })
    throw new Error("invalid_mp4_container")
  }

  const blob = new Blob([buffer], { type: "video/mp4" })
  options.onProgress?.(1)
  console.log("[viral-video]", {
    event: "recorded_h264",
    bytes: blob.size,
    codec,
    frames: frameIndex,
    mediaCount: medias.length,
  })

  return {
    blob,
    mimeType: "video/mp4",
    ext: "mp4",
    bytes: blob.size,
    codec,
  }
}

export function downloadViralVideoBlob(blob: Blob, filename: string, ext: "mp4" | "webm" = "mp4"): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Keep blob URL briefly so Finder / QuickTime can finish reading on some macOS builds
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Open exported MP4 in a new tab for instant QuickTime / browser preview. */
export function previewViralVideoBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}
