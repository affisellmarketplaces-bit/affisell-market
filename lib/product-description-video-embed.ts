/** YouTube / Vimeo embed + direct MP4 for product description media. */

export function youtubeEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.toLowerCase()
    let id: string | null = null
    if (host === "youtu.be") {
      id = u.pathname.replace(/^\//, "").split("/")[0] ?? null
    } else if (host.endsWith("youtube.com") || host === "youtube.com") {
      if (u.pathname.startsWith("/embed/")) {
        id = u.pathname.replace(/^\/embed\//, "").split("/")[0] ?? null
      } else if (u.pathname === "/watch") {
        id = u.searchParams.get("v")
      } else if (u.pathname.startsWith("/shorts/")) {
        id = u.pathname.replace(/^\/shorts\//, "").split("/")[0] ?? null
      }
    }
    if (!id || !/^[a-zA-Z0-9_-]{6,64}$/.test(id)) return null
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`
  } catch {
    return null
  }
}

export function vimeoEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.toLowerCase()
    if (!host.endsWith("vimeo.com") && host !== "vimeo.com") return null
    const parts = u.pathname.split("/").filter(Boolean)
    const id = parts[0] === "video" ? parts[1] : parts[0]
    if (!id || !/^\d+$/.test(id)) return null
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}`
  } catch {
    return null
  }
}

export function isDirectMp4Url(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    return /\.mp4(\?|#|$)/i.test(`${u.pathname}${u.search}`)
  } catch {
    return false
  }
}
