import {
  isDirectMp4Url,
  vimeoEmbedSrc,
  youtubeEmbedSrc,
} from "@/lib/product-description-video-embed"

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i

export type ProductVideoEmbedKind = "youtube" | "vimeo" | "direct"

export type ProductVideoEmbed = {
  kind: ProductVideoEmbedKind
  /** iframe `src` for YouTube/Vimeo, `<video src>` for direct files. */
  src: string
}

/** Direct file URL playable in `<video>` (MP4, WebM, Affisell-hosted blobs, Supabase, etc.). */
export function isPlayableDirectVideoUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (isDirectMp4Url(trimmed)) return true
  if (VIDEO_EXT_RE.test(trimmed)) return true

  try {
    const u = new URL(trimmed)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    const host = u.hostname.toLowerCase()
    const path = `${u.pathname}${u.search}`.toLowerCase()

    if (host.endsWith(".public.blob.vercel-storage.com")) return true
    if (host.endsWith(".blob.vercel-storage.com")) return true
    if (host.endsWith(".supabase.co") && path.includes("/storage/")) return true
    if (host.endsWith(".amazonaws.com") && (path.includes("/videos/") || VIDEO_EXT_RE.test(path))) {
      return true
    }
    if (path.includes("/video/") || path.includes("video_upload")) return true
  } catch {
    return false
  }

  return false
}

/** Gallery / PDP: native file or YouTube/Vimeo embed. */
export function isGalleryPlayableVideoUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  return (
    isPlayableDirectVideoUrl(trimmed) ||
    Boolean(youtubeEmbedSrc(trimmed)) ||
    Boolean(vimeoEmbedSrc(trimmed))
  )
}

export function resolveProductVideoEmbed(url: string): ProductVideoEmbed | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const yt = youtubeEmbedSrc(trimmed)
  if (yt) return { kind: "youtube", src: yt }

  const vm = vimeoEmbedSrc(trimmed)
  if (vm) return { kind: "vimeo", src: vm }

  if (isPlayableDirectVideoUrl(trimmed)) return { kind: "direct", src: trimmed }

  return null
}

/** Best hero/gallery clip for shoppers — prefers gallery placement, then generated SKU video. */
export function resolveGalleryListingVideoUrl(input: {
  videoAdUrl?: string | null
  productVideoUrl?: string | null
  descriptionIllustrationVideos?: string[]
}): string | null {
  const candidates = [
    input.videoAdUrl,
    input.productVideoUrl,
    ...(input.descriptionIllustrationVideos ?? []),
  ]

  for (const raw of candidates) {
    const url = raw?.trim()
    if (!url) continue
    if (isGalleryPlayableVideoUrl(url)) return url
  }

  return null
}
