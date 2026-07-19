import "server-only"

import * as cheerio from "cheerio"

import { radarFetch } from "@/lib/radar/crawler/http"
import type { GlobalProduct } from "@/lib/radar/crawler/types"

const TOP_N = 100

const AMAZON_HOST: Record<string, string> = {
  US: "www.amazon.com",
  FR: "www.amazon.fr",
  DE: "www.amazon.de",
  UK: "www.amazon.co.uk",
  GB: "www.amazon.co.uk",
}

function baseProduct(
  partial: Omit<GlobalProduct, "crawledAt"> & { crawledAt?: Date }
): GlobalProduct {
  return { ...partial, crawledAt: partial.crawledAt ?? new Date() }
}

async function searchTikTok(
  keyword: string,
  country: string
): Promise<GlobalProduct[]> {
  const token = process.env.TIKTOK_CRAWLER_ACCESS_TOKEN?.trim()
  if (!token) {
    console.log("[radar/crawler]", {
      marketplaceId: "tiktok_shop",
      result: "skipped",
      reason: "MISSING_KEY",
      key: "TIKTOK_CRAWLER_ACCESS_TOKEN",
      country,
    })
    return []
  }

  const apiBase =
    process.env.TIKTOK_SHOP_SEARCH_URL?.trim() ||
    process.env.TIKTOK_OPEN_API_BASE?.trim() ||
    "https://open-api.tiktokglobalshop.com"

  let url: URL
  if (process.env.TIKTOK_SHOP_SEARCH_URL?.trim()) {
    url = new URL(process.env.TIKTOK_SHOP_SEARCH_URL.trim())
  } else {
    url = new URL(
      "/api/products/search",
      apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase
    )
  }
  url.searchParams.set("keyword", keyword)
  url.searchParams.set("country", country)
  url.searchParams.set("page_size", String(TOP_N))

  const headers: HeadersInit = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
  }

  const res = await radarFetch(url.toString(), { headers })
  if (!res.ok) {
    console.log("[radar/crawler]", {
      marketplaceId: "tiktok_shop",
      result: "search_http_error",
      status: res.status,
      country,
    })
    return []
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const data = (json.data as Record<string, unknown> | undefined) ?? json
  const listRaw =
    (data.products as unknown[]) ??
    (data.list as unknown[]) ??
    (data.items as unknown[]) ??
    []

  if (!Array.isArray(listRaw)) return []

  const out: GlobalProduct[] = []
  for (let i = 0; i < Math.min(listRaw.length, TOP_N); i++) {
    const row = listRaw[i]
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const externalId = String(p.product_id ?? p.id ?? p.productId ?? "").trim()
    const title = String(p.title ?? p.product_name ?? p.name ?? "").trim()
    if (!externalId || !title) continue
    const priceRaw = p.price ?? p.sale_price ?? p.min_price
    const price =
      typeof priceRaw === "number"
        ? priceRaw
        : Number(String(priceRaw ?? "0").replace(/[^\d.]/g, "")) || 0
    out.push(
      baseProduct({
        marketplaceId: "tiktok_shop",
        externalId,
        title,
        price,
        currency: String(p.currency ?? "USD"),
        rank: i + 1,
        category: null,
        country,
        salesEst: typeof p.sales === "number" ? p.sales : null,
        imageUrl: typeof p.image_url === "string" ? p.image_url : null,
        url: typeof p.product_url === "string" ? p.product_url : null,
      })
    )
  }

  console.log("[radar/crawler]", {
    marketplaceId: "tiktok_shop",
    result: "search_ok",
    country,
    count: out.length,
  })
  return out
}

async function searchAmazon(keyword: string, country: string): Promise<GlobalProduct[]> {
  const host = AMAZON_HOST[country.toUpperCase()] ?? AMAZON_HOST.US
  const url = `https://${host}/s?k=${encodeURIComponent(keyword)}`
  const currency =
    country === "FR" || country === "DE"
      ? "EUR"
      : country === "UK" || country === "GB"
        ? "GBP"
        : "USD"

  const res = await radarFetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
  })

  if (!res.ok) {
    console.log("[radar/crawler]", {
      marketplaceId: "amazon",
      result: "search_http_error",
      status: res.status,
      country,
    })
    return []
  }

  const html = await res.text()
  const $ = cheerio.load(html)
  const out: GlobalProduct[] = []
  const seen = new Set<string>()

  $("div[data-asin]").each((i, el) => {
    if (out.length >= TOP_N) return
    const asin = ($(el).attr("data-asin") ?? "").trim()
    if (!asin || asin.length < 8 || seen.has(asin)) return
    seen.add(asin)
    const title =
      $(el).find("h2 a span").first().text().trim() ||
      $(el).find("img.s-image").attr("alt")?.trim() ||
      ""
    if (!title) return
    const priceText = $(el).find(".a-price .a-offscreen").first().text().trim()
    const price = Number(priceText.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    const imageUrl = $(el).find("img.s-image").attr("src") ?? null
    out.push(
      baseProduct({
        marketplaceId: "amazon",
        externalId: asin,
        title,
        price,
        currency,
        rank: i + 1,
        category: null,
        country: country.toUpperCase(),
        salesEst: null,
        imageUrl,
        url: `https://${host}/dp/${asin}`,
      })
    )
  })

  console.log("[radar/crawler]", {
    marketplaceId: "amazon",
    result: "search_ok",
    country,
    count: out.length,
  })
  return out
}

/** Search marketplace listings by keyword. */
export async function crawlKeyword(
  marketplaceId: string,
  keyword: string,
  country: string
): Promise<GlobalProduct[]> {
  const id = marketplaceId.trim().toLowerCase()
  const q = keyword.trim()
  const cc = country.trim().toUpperCase() || "US"
  if (!q) return []

  if (id === "tiktok_shop" || id === "tiktok") {
    return searchTikTok(q, cc)
  }
  if (id === "amazon") {
    return searchAmazon(q, cc)
  }

  console.log("[radar/crawler]", {
    marketplaceId: id,
    result: "search_unsupported",
    country: cc,
  })
  return []
}
