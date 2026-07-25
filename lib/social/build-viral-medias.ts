import type { ViralMedia } from "@/types/product"

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i
const MAX_IMAGES = 6

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("/")
}

function isDirectVideoFile(url: string): boolean {
  return VIDEO_EXT.test(url)
}

function isEmbedOnly(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url)
}

/**
 * Build ordered medias for ViralCarousel: photos first, product video slotted mid-pack.
 * Idempotent — dedupes by URL. Client-safe (no margin / cost).
 */
export function buildViralMedias(input: {
  images?: Array<string | null | undefined>
  customImages?: Array<string | null | undefined>
  videoUrl?: string | null
  videoAdUrl?: string | null
  illustrationVideos?: Array<string | null | undefined>
}): ViralMedia[] {
  const seen = new Set<string>()
  const images: ViralMedia[] = []

  const pushImage = (raw: string | null | undefined) => {
    const url = raw?.trim()
    if (!url || !isHttpUrl(url) || seen.has(url)) return
    if (isDirectVideoFile(url) || isEmbedOnly(url)) return
    seen.add(url)
    images.push({ type: "image", url, duration: 1200 })
  }

  for (const u of input.customImages ?? []) pushImage(u)
  for (const u of input.images ?? []) pushImage(u)

  const limited = images.slice(0, MAX_IMAGES)

  const videoCandidates = [
    input.videoUrl,
    input.videoAdUrl,
    ...(input.illustrationVideos ?? []),
  ]
  let video: ViralMedia | null = null
  for (const raw of videoCandidates) {
    const url = raw?.trim()
    if (!url || !isHttpUrl(url) || seen.has(url)) continue
    if (isEmbedOnly(url)) continue
    if (!isDirectVideoFile(url)) continue
    seen.add(url)
    video = { type: "video", url, duration: 3000 }
    break
  }

  if (!video) return limited
  if (limited.length === 0) return [video]

  const insertAt = Math.min(2, limited.length)
  return [...limited.slice(0, insertAt), video, ...limited.slice(insertAt)]
}
