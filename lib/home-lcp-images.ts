import { normalizeHomeCatalogProduct } from "@/lib/home-catalog-product-href"

/** First above-the-fold product images on home `#explorer` (LCP / preload hints). */
export function pickHomeLcpImageUrls(products: unknown[], limit = 2): string[] {
  if (!Array.isArray(products) || limit <= 0) return []

  const urls: string[] = []
  for (const raw of products) {
    if (urls.length >= limit) break
    const row = normalizeHomeCatalogProduct(raw)
    if (!row?.image || urls.includes(row.image)) continue
    urls.push(row.image)
  }
  return urls
}
