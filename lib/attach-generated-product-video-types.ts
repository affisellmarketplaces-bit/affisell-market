export type AttachVideoPlacement = "description" | "afterGallery"

export function isAffisellHostedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    const host = u.hostname.toLowerCase()
    if (host.endsWith(".public.blob.vercel-storage.com")) return true
    if (host.endsWith(".blob.vercel-storage.com")) return true
    return /\.mp4(\?|#|$)/i.test(`${u.pathname}${u.search}`)
  } catch {
    return false
  }
}
