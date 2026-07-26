import "server-only"

import { createHash } from "crypto"

import {
  getSerperApiKey,
  isSerperConfigured,
  serperSearchRaw,
} from "@/lib/radar/crawler/serper-client"
import { radarFetch } from "@/lib/radar/crawler/http"
import type { GlobalProduct } from "@/lib/radar/crawler/types"

const TOP_N = 40

/** Marketplaces crawled via Serper (Shopping + site: organic). */
export const SERPER_CRAWL_MARKETPLACE_IDS = [
  "google_merchant",
  "shopify",
  "ebay",
  "walmart",
  "etsy",
  "aliexpress",
  "temu",
  "mercadolibre",
] as const

export type SerperCrawlMarketplaceId = (typeof SERPER_CRAWL_MARKETPLACE_IDS)[number]

type MarketSpec = {
  id: SerperCrawlMarketplaceId
  /** Prefer Serper Shopping endpoint when true. */
  shopping: boolean
  /** site: filter for organic/shopping query. */
  siteForCountry?: (cc: string) => string | null
  /** Extra query tokens (brand / marketplace name). */
  queryHint: string
  /** Countries where this source is relevant (empty = all). */
  countries?: string[]
}

const MARKET_SPECS: MarketSpec[] = [
  {
    id: "google_merchant",
    shopping: true,
    queryHint: "bestsellers",
  },
  {
    id: "shopify",
    shopping: false,
    queryHint: "bestsellers buy online",
    siteForCountry: () => "myshopify.com",
  },
  {
    id: "ebay",
    shopping: true,
    queryHint: "bestsellers",
    siteForCountry: (cc) => {
      const hosts: Record<string, string> = {
        US: "ebay.com",
        GB: "ebay.co.uk",
        UK: "ebay.co.uk",
        DE: "ebay.de",
        FR: "ebay.fr",
        MX: "ebay.com",
      }
      return hosts[cc] ?? "ebay.com"
    },
  },
  {
    id: "walmart",
    shopping: true,
    queryHint: "bestsellers",
    siteForCountry: () => "walmart.com",
    countries: ["US", "MX", "CA"],
  },
  {
    id: "etsy",
    shopping: true,
    queryHint: "bestsellers handmade",
    siteForCountry: () => "etsy.com",
  },
  {
    id: "aliexpress",
    shopping: true,
    queryHint: "bestsellers",
    siteForCountry: () => "aliexpress.com",
  },
  {
    id: "temu",
    shopping: true,
    queryHint: "bestsellers",
    siteForCountry: () => "temu.com",
  },
  {
    id: "mercadolibre",
    shopping: true,
    queryHint: "más vendidos",
    siteForCountry: (cc) => {
      const hosts: Record<string, string> = {
        MX: "mercadolibre.com.mx",
        AR: "mercadolibre.com.ar",
        BR: "mercadolivre.com.br",
        CL: "mercadolibre.cl",
        CO: "mercadolibre.com.co",
      }
      return hosts[cc] ?? null
    },
    countries: ["MX", "AR", "BR", "CL", "CO"],
  },
]

function serperGl(cc: string): string {
  const map: Record<string, string> = {
    GB: "uk",
    UK: "uk",
    US: "us",
    FR: "fr",
    DE: "de",
    MX: "mx",
    ES: "es",
    IT: "it",
    BR: "br",
    CA: "ca",
    JP: "jp",
    AU: "au",
  }
  return map[cc] ?? cc.toLowerCase()
}

function currencyForCountry(cc: string): string {
  if (cc === "GB" || cc === "UK") return "GBP"
  if (["FR", "DE", "ES", "IT", "NL", "BE", "AT", "PT"].includes(cc)) return "EUR"
  if (cc === "MX") return "MXN"
  if (cc === "BR") return "BRL"
  return "USD"
}

function stableExternalId(marketplaceId: string, url: string, title: string): string {
  const raw = `${marketplaceId}|${url || title}`.slice(0, 500)
  return createHash("sha256").update(raw).digest("hex").slice(0, 24)
}

function parsePrice(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const s = String(raw ?? "").replace(/[^\d.,]/g, "").replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function estimateDemand(rank: number): number {
  return Math.max(50, (TOP_N - rank + 1) * 180)
}

async function serperShoppingRaw(
  query: string,
  gl: string
): Promise<Record<string, unknown> | null> {
  const key = getSerperApiKey()
  if (!key) return null
  const q = query.trim()
  if (!q) return null

  try {
    const res = await radarFetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({ q, gl, num: TOP_N }),
    })
    if (!res.ok) {
      console.warn("[radar/serper-shopping]", { result: "http_error", status: res.status, q })
      return null
    }
    return (await res.json().catch(() => null)) as Record<string, unknown> | null
  } catch (err) {
    console.warn("[radar/serper-shopping]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return null
  }
}

function rowsFromShoppingPayload(json: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(json.shopping)) return json.shopping as Record<string, unknown>[]
  if (Array.isArray(json.organic)) return json.organic as Record<string, unknown>[]
  return []
}

function mapRowToProduct(opts: {
  row: Record<string, unknown>
  marketplaceId: string
  category: string
  country: string
  rank: number
  currency: string
}): GlobalProduct | null {
  const title = String(opts.row.title ?? opts.row.name ?? "").trim()
  if (!title) return null
  const url = String(opts.row.link ?? opts.row.url ?? opts.row.productLink ?? "").trim() || null
  const price = parsePrice(opts.row.price ?? opts.row.extracted_price ?? opts.row.priceStr)
  const imageUrl =
    typeof opts.row.imageUrl === "string"
      ? opts.row.imageUrl
      : typeof opts.row.image === "string"
        ? opts.row.image
        : typeof opts.row.thumbnail === "string"
          ? opts.row.thumbnail
          : null
  const externalId = stableExternalId(opts.marketplaceId, url ?? "", title)

  return {
    marketplaceId: opts.marketplaceId,
    externalId,
    title,
    price,
    currency: opts.currency,
    rank: opts.rank,
    category: opts.category,
    country: opts.country,
    salesEst: estimateDemand(opts.rank),
    imageUrl,
    url,
    crawledAt: new Date(),
  }
}

/**
 * Crawl one major marketplace via Serper Shopping / organic.
 * Missing SERPER_API_KEY → [] (Amazon/TikTok/Shopee continue).
 */
export async function crawlSerperMarketplaceBestSellers(
  marketplaceId: string,
  category: string,
  country: string
): Promise<GlobalProduct[]> {
  const id = marketplaceId.trim().toLowerCase() as SerperCrawlMarketplaceId
  const spec = MARKET_SPECS.find((m) => m.id === id)
  if (!spec) return []

  const cc = country.trim().toUpperCase() || "US"
  if (spec.countries && !spec.countries.includes(cc)) {
    console.log("[radar/crawler]", {
      marketplaceId: id,
      result: "skipped_country",
      country: cc,
    })
    return []
  }

  if (!isSerperConfigured()) {
    console.log("[radar/crawler]", {
      marketplaceId: id,
      result: "skipped",
      reason: "MISSING_KEY",
      key: "SERPER_API_KEY",
      category,
      country: cc,
    })
    return []
  }

  const site = spec.siteForCountry?.(cc) ?? null
  const cat = category.trim().toLowerCase()
  const qParts = [cat, spec.queryHint]
  if (site) qParts.push(`site:${site}`)
  const q = qParts.filter(Boolean).join(" ")
  const gl = serperGl(cc)
  const currency = currencyForCountry(cc)

  let rows: Record<string, unknown>[] = []
  if (spec.shopping) {
    const shopping = await serperShoppingRaw(q, gl)
    if (shopping) rows = rowsFromShoppingPayload(shopping)
  }
  if (rows.length === 0) {
    const organic = await serperSearchRaw(q, { gl })
    if (organic) {
      rows = Array.isArray(organic.organic)
        ? (organic.organic as Record<string, unknown>[])
        : rowsFromShoppingPayload(organic)
    }
  }

  const out: GlobalProduct[] = []
  for (let i = 0; i < Math.min(rows.length, TOP_N); i++) {
    const mapped = mapRowToProduct({
      row: rows[i]!,
      marketplaceId: id,
      category: cat,
      country: cc,
      rank: i + 1,
      currency,
    })
    if (mapped) out.push(mapped)
  }

  console.log("[radar/crawler]", {
    marketplaceId: id,
    result: out.length > 0 ? "bestsellers_serper_ok" : "bestsellers_serper_empty",
    category: cat,
    country: cc,
    count: out.length,
    shopping: spec.shopping,
  })
  return out
}

export function isSerperCrawlMarketplace(id: string): boolean {
  return (SERPER_CRAWL_MARKETPLACE_IDS as readonly string[]).includes(id.trim().toLowerCase())
}

export function serperMarketplacesForCountry(country: string): string[] {
  const cc = country.trim().toUpperCase()
  return MARKET_SPECS.filter((s) => !s.countries || s.countries.includes(cc)).map((s) => s.id)
}
