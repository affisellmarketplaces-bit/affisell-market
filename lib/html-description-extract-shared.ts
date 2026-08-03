/** Client-safe HTML description helpers (no cheerio). */

export type ExtractedHtmlDescription = {
  /** Visible text with block breaks; optional [[img:N]] markers when images extracted inline */
  text: string
  /** Absolute https image URLs in document order, deduped */
  imageUrls: string[]
  hadHtml: boolean
}

export function looksLikeHtmlDescription(input: string): boolean {
  const s = input.trim()
  if (!s) return false
  if (/detailmodule_|detail-desc-decorate|richtext/i.test(s)) return true
  if (/&lt;\s*\/?\s*[a-z]/i.test(s)) return true
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : _
    })
}

function absolutizeUrl(raw: string): string | null {
  const t = raw.trim().replace(/^\/\//, "https://")
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t.split("?")[0]?.includes("alicdn") ? t : t
  if (t.startsWith("/") && t.includes("alicdn")) return `https://ae01.alicdn.com${t}`
  return null
}

/**
 * Lightweight regex extract for client / defense-in-depth.
 * Prefer server cheerio extract when available.
 */
export function extractHtmlDescriptionLight(
  input: string,
  opts?: { insertImageMarkers?: boolean; maxImages?: number }
): ExtractedHtmlDescription {
  const insertMarkers = opts?.insertImageMarkers !== false
  const maxImages = Math.min(80, Math.max(1, opts?.maxImages ?? 40))
  const raw = input.trim()
  if (!raw) return { text: "", imageUrls: [], hadHtml: false }
  if (!looksLikeHtmlDescription(raw)) {
    return { text: raw.slice(0, 20_000), imageUrls: [], hadHtml: false }
  }

  const imageUrls: string[] = []
  const seen = new Set<string>()
  const imgRe =
    /<img\b[^>]*(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi

  let withMarkers = raw
  if (insertMarkers) {
    withMarkers = raw.replace(imgRe, (full, src: string) => {
      const abs = absolutizeUrl(src)
      if (!abs || seen.has(abs) || imageUrls.length >= maxImages) return "\n"
      seen.add(abs)
      const idx = imageUrls.length
      imageUrls.push(abs)
      return `\n[[img:${idx}]]\n`
    })
  } else {
    let m: RegExpExecArray | null
    const re = new RegExp(imgRe.source, "gi")
    while ((m = re.exec(raw)) !== null) {
      const abs = absolutizeUrl(m[1] ?? "")
      if (!abs || seen.has(abs) || imageUrls.length >= maxImages) continue
      seen.add(abs)
      imageUrls.push(abs)
    }
    withMarkers = raw
  }

  let text = withMarkers
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
  text = decodeBasicEntities(text)
  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 20_000)

  return { text, imageUrls, hadHtml: true }
}

/** Prefer clean customDescription for listing form defaults. */
export function sanitizeListingDescriptionField(input: string | null | undefined): string {
  const raw = (input ?? "").trim()
  if (!raw) return ""
  if (!looksLikeHtmlDescription(raw)) return raw.slice(0, 16_000)
  return extractHtmlDescriptionLight(raw, { insertImageMarkers: true }).text.slice(0, 16_000)
}
