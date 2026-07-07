/** First above-the-fold product images on home `#explorer` (LCP / preload hints). */
export function pickHomeLcpImageUrls(products: unknown[], limit = 4): string[] {
  if (!Array.isArray(products) || limit <= 0) return []

  const urls: string[] = []
  for (const raw of products) {
    if (urls.length >= limit) break
    if (!raw || typeof raw !== "object") continue
    const row = raw as Record<string, unknown>
    const fromField = typeof row.image === "string" ? row.image.trim() : ""
    const fromList =
      Array.isArray(row.images) && typeof row.images[0] === "string"
        ? row.images[0].trim()
        : ""
    const href = fromField || fromList
    if ((!href.startsWith("http") && !href.startsWith("/")) || urls.includes(href)) continue
    urls.push(href)
  }
  return urls
}
