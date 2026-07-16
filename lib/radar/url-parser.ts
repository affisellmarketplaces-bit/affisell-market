const MARKETPLACE_HOST_HINTS: Array<{ id: string; needles: string[] }> = [
  { id: "amazon", needles: ["amazon.", "amzn.", "amazon.co", "amazon.com"] },
  { id: "mercadolibre", needles: ["mercadolibre.", "mercadolivre.", "meli."] },
  { id: "tiktok_shop", needles: ["tiktok.com", "tiktokshop.", "shop.tiktok"] },
  { id: "jumia", needles: ["jumia."] },
  { id: "noon", needles: ["noon.com", "noon."] },
  { id: "shopee", needles: ["shopee."] },
  { id: "allegro", needles: ["allegro."] },
  { id: "walmart", needles: ["walmart."] },
  { id: "google_merchant", needles: ["google.com/shopping", "merchantcenter.google", "googleapis.com/content"] },
  { id: "google_search_console", needles: ["search.google.com/search-console", "webmasters"] },
  { id: "google_trends", needles: ["trends.google."] },
]

/** Detect Radar connector id from a product / listing URL. */
export function detectMarketplace(url: string): string | null {
  const raw = url.trim().toLowerCase()
  if (!raw) return null

  for (const entry of MARKETPLACE_HOST_HINTS) {
    if (entry.needles.some((n) => raw.includes(n))) return entry.id
  }
  return null
}

/** Best-effort product / ASIN / slug extraction from marketplace URLs. */
export function extractProductId(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null

  try {
    const u = new URL(raw)

    const asin = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    if (asin?.[1]) return asin[1]

    const mlb = u.pathname.match(/\/(?:p|produto)\/([A-Z]{3}\d+)/i) ?? u.pathname.match(/ML[A-Z]-\d+/i)
    if (mlb?.[0]) return mlb[0].replace("/", "")

    const shopee = u.pathname.match(/\.(\d+)\.(\d+)/)
    if (shopee?.[2]) return shopee[2]

    const allegro = u.pathname.match(/\/oferta\/[^/]+-(\d+)/i)
    if (allegro?.[1]) return allegro[1]

    const tiktok = u.searchParams.get("product_id") ?? u.pathname.match(/\/product\/(\d+)/)?.[1]
    if (tiktok) return tiktok

    const walmart = u.pathname.match(/\/ip\/[^/]+\/(\d+)/)
    if (walmart?.[1]) return walmart[1]

    const last = u.pathname.split("/").filter(Boolean).pop()
    if (last && /^[\w-]{6,}$/.test(last)) return last
  } catch {
    return null
  }

  return null
}
