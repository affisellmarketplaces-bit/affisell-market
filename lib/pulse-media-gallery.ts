import type { PulseFeedItem, PulseMediaSlide } from "@/lib/pulse-feed-types"

export const PULSE_VIDEO_URL_RE = /\.(mp4|webm|mov|m4v)(\?.*)?$/i

export function isPulseVideoUrl(url: string): boolean {
  return PULSE_VIDEO_URL_RE.test(url.trim())
}

/** Deduped gallery slides preserving first-seen order. */
export function buildPulseMediaGallery(urls: string[]): PulseMediaSlide[] {
  const seen = new Set<string>()
  const out: PulseMediaSlide[] = []
  for (const raw of urls) {
    const url = typeof raw === "string" ? raw.trim() : ""
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ url, isVideo: isPulseVideoUrl(url) })
  }
  return out
}

export function pickPulsePrimaryMedia(urls: string[]): PulseMediaSlide | null {
  const gallery = buildPulseMediaGallery(urls)
  const video = gallery.find((s) => s.isVideo)
  if (video) return video
  return gallery[0] ?? null
}

export function resolvePulseMediaSlides(item: PulseFeedItem): PulseMediaSlide[] {
  if (item.mediaGallery?.length) return item.mediaGallery
  if (item.mediaUrl?.trim()) {
    return [{ url: item.mediaUrl.trim(), isVideo: item.isVideo }]
  }
  return []
}

export function pulseMediaStartIndex(slides: PulseMediaSlide[], mediaUrl: string): number {
  const idx = slides.findIndex((s) => s.url === mediaUrl.trim())
  return idx >= 0 ? idx : 0
}
