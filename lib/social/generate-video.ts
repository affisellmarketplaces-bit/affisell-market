import type { ViralMedia } from "@/types/product"

export type ViralVideoExportOptions = {
  medias: ViralMedia[]
  width?: number
  height?: number
  fps?: number
  /** Total target duration when only images (ms). */
  imageHoldMs?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

function pickRecorderMime(): { mimeType: string; ext: "mp4" | "webm" } {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/mp4")) {
    return { mimeType: "video/mp4", ext: "mp4" }
  }
  if (
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
  ) {
    return { mimeType: "video/webm;codecs=vp9", ext: "webm" }
  }
  return { mimeType: "video/webm", ext: "webm" }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
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

/**
 * Option A (prod-ready): canvas + MediaRecorder — Ken Burns carousel → MP4/WebM 1080×1920.
 * Browser may emit WebM when MP4 encoder unavailable; caller uses returned `ext`.
 */
export async function recordViralCarouselVideo(
  options: ViralVideoExportOptions
): Promise<{ blob: Blob; mimeType: string; ext: "mp4" | "webm" }> {
  const medias = options.medias.filter((m) => Boolean(m.url))
  if (medias.length === 0) throw new Error("no_medias")

  const width = options.width ?? 1080
  const height = options.height ?? 1920
  const fps = options.fps ?? 30
  const imageHoldMs = options.imageHoldMs ?? 1400

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas_unavailable")

  const stream = canvas.captureStream(fps)
  const { mimeType, ext } = pickRecorderMime()
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    recorder.onerror = () => reject(new Error("media_recorder_failed"))
  })

  recorder.start(100)

  const frameMs = 1000 / fps
  let framesDrawn = 0
  const totalEstimate =
    medias.reduce((acc, m) => {
      if (m.type === "video") return acc + Math.round(((m.duration ?? 3000) / 1000) * fps)
      return acc + Math.round((imageHoldMs / 1000) * fps)
    }, 0) || 1

  try {
    for (let mi = 0; mi < medias.length; mi++) {
      if (options.signal?.aborted) throw new Error("aborted")
      const media = medias[mi]!

      if (media.type === "image") {
        const img = await loadImage(media.url)
        const hold = media.duration ?? imageHoldMs
        const frames = Math.max(1, Math.round((hold / 1000) * fps))
        for (let f = 0; f < frames; f++) {
          if (options.signal?.aborted) throw new Error("aborted")
          const t = frames <= 1 ? 0 : f / (frames - 1)
          const scale = 1.08 - t * 0.08
          ctx.fillStyle = "#0f172a"
          ctx.fillRect(0, 0, width, height)
          coverDraw(ctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height, width, height, scale)
          framesDrawn++
          options.onProgress?.(Math.min(0.99, framesDrawn / totalEstimate))
          await new Promise((r) => window.setTimeout(r, frameMs))
        }
      } else {
        const video = await loadVideo(media.url)
        await video.play().catch(() => undefined)
        const hold = media.duration ?? Math.min(4000, (video.duration || 3) * 1000)
        const frames = Math.max(1, Math.round((hold / 1000) * fps))
        for (let f = 0; f < frames; f++) {
          if (options.signal?.aborted) throw new Error("aborted")
          ctx.fillStyle = "#0f172a"
          ctx.fillRect(0, 0, width, height)
          if (video.videoWidth > 0) {
            coverDraw(ctx, video, video.videoWidth, video.videoHeight, width, height, 1)
          }
          framesDrawn++
          options.onProgress?.(Math.min(0.99, framesDrawn / totalEstimate))
          await new Promise((r) => window.setTimeout(r, frameMs))
        }
        video.pause()
      }
    }
  } finally {
    if (recorder.state !== "inactive") recorder.stop()
    stream.getTracks().forEach((t) => t.stop())
  }

  const blob = await stopped
  options.onProgress?.(1)
  console.log("[viral-video]", {
    event: "recorded",
    bytes: blob.size,
    mimeType,
    ext,
    mediaCount: medias.length,
  })
  return { blob, mimeType, ext }
}

export function downloadViralVideoBlob(
  blob: Blob,
  filename: string,
  ext: "mp4" | "webm"
): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
