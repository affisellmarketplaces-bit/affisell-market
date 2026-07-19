import "server-only"

import { radarFetch } from "@/lib/radar/crawler/http"
import type { GlobalProduct } from "@/lib/radar/crawler/types"
import type { MarketplaceConnector } from "@/lib/radar/connectors/types"

export const SHOPEE_COUNTRIES = ["MY", "SG", "TH", "VN", "PH"] as const
export type ShopeeCountry = (typeof SHOPEE_COUNTRIES)[number]

const SHOPEE_HOST: Record<ShopeeCountry, { host: string; currency: string }> = {
  MY: { host: "shopee.com.my", currency: "MYR" },
  SG: { host: "shopee.sg", currency: "SGD" },
  TH: { host: "shopee.co.th", currency: "THB" },
  VN: { host: "shopee.vn", currency: "VND" },
  PH: { host: "shopee.ph", currency: "PHP" },
}

export function isShopeeCountry(cc: string): cc is ShopeeCountry {
  return (SHOPEE_COUNTRIES as readonly string[]).includes(cc.toUpperCase())
}

export function resolveShopeeCountry(country: string): ShopeeCountry {
  const cc = country.trim().toUpperCase()
  return isShopeeCountry(cc) ? cc : "MY"
}

/** Shopee often encodes price as integer × 100_000. */
export function parseShopeePrice(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1000) return Math.round((raw / 100_000) * 100) / 100
    return raw
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function imageUrlFromHash(hash: string | null | undefined, host: string): string | null {
  const h = (hash ?? "").trim()
  if (!h) return null
  if (h.startsWith("http")) return h
  return `https://cf.shopee.com.my/file/${h}`
}

export type ShopeeParsedItem = {
  externalId: string
  shopId: string
  title: string
  price: number
  currency: string
  imageUrl: string | null
  url: string
  country: string
}

/**
 * Parse Shopee search_items JSON (v4). Pure — used by tests + connector.
 */
export function parseShopeeSearchItems(
  json: unknown,
  country: ShopeeCountry,
  limit = 20
): ShopeeParsedItem[] {
  const { host, currency } = SHOPEE_HOST[country]
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<
    string,
    unknown
  >
  const itemsRaw = (data.items as unknown[]) ?? (root.items as unknown[]) ?? []
  if (!Array.isArray(itemsRaw)) return []

  const out: ShopeeParsedItem[] = []
  for (const row of itemsRaw) {
    if (out.length >= limit) break
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const basic =
      r.item_basic && typeof r.item_basic === "object"
        ? (r.item_basic as Record<string, unknown>)
        : r

    const itemId = String(basic.itemid ?? basic.item_id ?? r.itemid ?? "").trim()
    const shopId = String(basic.shopid ?? basic.shop_id ?? r.shopid ?? "").trim()
    const title = String(basic.name ?? basic.title ?? "").trim()
    if (!itemId || !title) continue

    const price = parseShopeePrice(
      basic.price_min ?? basic.price ?? basic.price_max ?? basic.price_before_discount
    )
    const image =
      typeof basic.image === "string"
        ? basic.image
        : Array.isArray(basic.images) && typeof basic.images[0] === "string"
          ? basic.images[0]
          : null

    out.push({
      externalId: itemId,
      shopId: shopId || "0",
      title,
      price,
      currency: String(basic.currency ?? currency).toUpperCase(),
      imageUrl: imageUrlFromHash(image, host),
      url: `https://${host}/product/${shopId || "0"}/${itemId}`,
      country,
    })
  }
  return out
}

function toGlobalProduct(item: ShopeeParsedItem, rank: number, category: string | null): GlobalProduct {
  return {
    marketplaceId: "shopee",
    externalId: item.externalId,
    title: item.title,
    price: item.price,
    currency: item.currency,
    rank,
    category,
    country: item.country,
    salesEst: null,
    imageUrl: item.imageUrl,
    url: item.url,
    crawledAt: new Date(),
  }
}

/**
 * Public Shopee search (no OAuth). Degraded: returns [] + warn on failure — never throws.
 */
export async function searchShopee(
  query: string,
  country: string,
  opts?: { limit?: number; category?: string | null }
): Promise<GlobalProduct[]> {
  const q = query.trim()
  if (!q) return []

  const cc = resolveShopeeCountry(country)
  const { host } = SHOPEE_HOST[cc]
  const limit = opts?.limit ?? 20
  const url = new URL(`https://${host}/api/v4/search/search_items`)
  url.searchParams.set("by", "relevancy")
  url.searchParams.set("keyword", q)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("newest", "0")
  url.searchParams.set("order", "desc")
  url.searchParams.set("page_type", "search")
  url.searchParams.set("scenario", "PAGE_GLOBAL_SEARCH")
  url.searchParams.set("version", "2")

  try {
    const res = await radarFetch(url.toString(), {
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (compatible; AffisellRadar/1.0; +https://affisell.com)",
        referer: `https://${host}/search?keyword=${encodeURIComponent(q)}`,
        "x-api-source": "pc",
        "x-requested-with": "XMLHttpRequest",
        "x-shopee-language": "en",
      },
    })

    if (!res.ok) {
      console.warn("[radar/shopee]", {
        result: "http_error",
        status: res.status,
        country: cc,
        query: q.slice(0, 40),
      })
      return []
    }

    const json = await res.json().catch(() => null)
    const parsed = parseShopeeSearchItems(json, cc, limit)
    const products = parsed.map((p, i) => toGlobalProduct(p, i + 1, opts?.category ?? null))

    console.log("[radar/shopee]", {
      result: "ok",
      country: cc,
      count: products.length,
      query: q.slice(0, 40),
    })
    return products
  } catch (err) {
    console.warn("[radar/shopee]", {
      result: "error",
      country: cc,
      message: err instanceof Error ? err.message : "unknown",
    })
    return []
  }
}

/** Best-sellers proxy: category keyword search on Shopee. */
export async function crawlShopeeBestSellers(
  category: string,
  country: string
): Promise<GlobalProduct[]> {
  const keyword = category.trim() || "electronics"
  return searchShopee(keyword, country, { limit: 20, category: keyword })
}

export const shopeeConnector: MarketplaceConnector = {
  id: "shopee",
  name: "Shopee",
  logo: "🟠",
  category: "marketplace",
  region: "SEA",
  authType: "api_key",
  requiresAuth: false,
  countries: [...SHOPEE_COUNTRIES],
  getAuthUrl: () => "/radar?marketplace=shopee",
}
