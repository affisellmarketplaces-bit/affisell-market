/** Parse up to 4 illustration image URLs (same hygiene as main gallery: drop blob:). */
export function parseDescriptionIllustrationImages(body: Record<string, unknown>): string[] {
  const raw = body.descriptionIllustrationImages
  if (!Array.isArray(raw)) return []
  return raw
    .filter((u): u is string => typeof u === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith("blob:"))
    .slice(0, 4)
}

function isAllowedVideoUrl(s: string): boolean {
  if (s.length > 2000) return false
  try {
    const u = new URL(s)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    const host = u.hostname.toLowerCase()
    if (host === "youtu.be" || host.endsWith(".youtube.com") || host === "youtube.com") return true
    if (host.endsWith("vimeo.com") || host === "vimeo.com") return true
    if (/\.mp4(\?|#|$)/i.test(`${u.pathname}${u.search}`)) return true
    return false
  } catch {
    return false
  }
}

/** Parse up to 2 video / embed URLs (YouTube, Vimeo, or direct MP4). */
export function parseDescriptionIllustrationVideos(body: Record<string, unknown>): string[] {
  const raw = body.descriptionIllustrationVideos
  if (!Array.isArray(raw)) return []
  return raw
    .filter((u): u is string => typeof u === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isAllowedVideoUrl)
    .slice(0, 2)
}
