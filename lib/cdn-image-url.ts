/**
 * Normalize marketplace CDN URLs (AliExpress often returns `//ae01.alicdn.com/...`).
 * Downstream filters require absolute `http(s)://` — without this, galleries look empty.
 */
export function absolutizeCdnImageUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith("//")) {
    const abs = `https:${t}`
    return /^https:\/\//i.test(abs) ? abs : null
  }
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith("/") && /alicdn|aliexpress/i.test(t)) {
    return `https://ae01.alicdn.com${t}`
  }
  return null
}

/** Collect + absolutize + dedupe image URLs from AE array / semicolon string payloads. */
export function collectAbsolutizedImageUrls(raw: unknown, max = 40): string[] {
  const candidates: string[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) candidates.push(item.trim())
      else if (item && typeof item === "object" && !Array.isArray(item)) {
        const r = item as Record<string, unknown>
        for (const k of ["url", "src", "image_url", "imageUrl", "img_url"]) {
          if (typeof r[k] === "string" && (r[k] as string).trim()) {
            candidates.push((r[k] as string).trim())
            break
          }
        }
      }
    }
  } else if (typeof raw === "string" && raw.trim()) {
    candidates.push(...raw.split(/[;,]/).map((u) => u.trim()).filter(Boolean))
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const c of candidates) {
    const abs = absolutizeCdnImageUrl(c)
    if (!abs || seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
    if (out.length >= max) break
  }
  return out
}
