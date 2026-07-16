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

const AMAZON_BESTSELLER_PATH: Record<string, string> = {
  electronics: "electronics",
  fashion: "fashion",
  beauty: "beauty",
  home: "home-garden",
}

function baseProduct(
  partial: Omit<GlobalProduct, "crawledAt"> & { crawledAt?: Date }
): GlobalProduct {
  return { ...partial, crawledAt: partial.crawledAt ?? new Date() }
}

async function crawlTikTokBestSellers(
  category: string,
  country: string
): Promise<GlobalProduct[]> {
  const apiBase =
    process.env.TIKTOK_SHOP_TRENDING_URL?.trim() ||
    process.env.TIKTOK_OPEN_API_BASE?.trim() ||
    "https://open-api.tiktokglobalshop.com"

  const token = process.env.TIKTOK_CRAWLER_ACCESS_TOKEN?.trim()
  const url = new URL("/api/products/trending", apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase)
  // Prefer documented-style path; also try /product/202309/products/search via env override
  if (process.env.TIKTOK_SHOP_TRENDING_URL?.trim()) {
    url.href = process.env.TIKTOK_SHOP_TRENDING_URL.trim()
  }
  url.searchParams.set("category", category)
  url.searchParams.set("country", country)
  url.searchParams.set("page_size", String(TOP_N))

  const headers: HeadersInit = { accept: "application/json" }
  if (token) headers.authorization = `Bearer ${token}`

  const res = await radarFetch(url.toString(), { headers })
  if (!res.ok) {
    console.log("[radar/crawler]", {
      marketplaceId: "tiktok_shop",
      result: "trending_http_error",
      status: res.status,
      category,
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
        rank: typeof p.rank === "number" ? p.rank : i + 1,
        category,
        country,
        salesEst:
          typeof p.sales === "number"
            ? p.sales
            : typeof p.sold_count === "number"
              ? p.sold_count
              : null,
        imageUrl: typeof p.image_url === "string" ? p.image_url : typeof p.cover === "string" ? p.cover : null,
        url: typeof p.product_url === "string" ? p.product_url : typeof p.url === "string" ? p.url : null,
      })
    )
  }

  console.log("[radar/crawler]", {
    marketplaceId: "tiktok_shop",
    result: "bestsellers_ok",
    category,
    country,
    count: out.length,
  })
  return out
}

async function crawlAmazonSpApi(
  category: string,
  country: string
): Promise<GlobalProduct[] | null> {
  const accessToken = process.env.AMAZON_SP_API_ACCESS_TOKEN?.trim()
  const endpoint =
    process.env.AMAZON_SP_API_ENDPOINT?.trim() ||
    "https://sellingpartnerapi-na.amazon.com"
  if (!accessToken) return null

  const path =
    process.env.AMAZON_SP_API_BESTSELLERS_PATH?.trim() ||
    `/catalog/2022-04-01/items?keywords=${encodeURIComponent(category)}&marketplaceIds=ATVPDKIKX0DER&pageSize=20`

  const res = await radarFetch(`${endpoint.replace(/\/$/, "")}${path}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-amz-access-token": accessToken,
    },
  })

  if (!res.ok) {
    console.log("[radar/crawler]", {
      marketplaceId: "amazon",
      result: "sp_api_http_error",
      status: res.status,
      category,
      country,
    })
    return null
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const items = (json.items as unknown[]) ?? (json.payload as unknown[]) ?? []
  if (!Array.isArray(items)) return []

  const out: GlobalProduct[] = []
  for (let i = 0; i < Math.min(items.length, TOP_N); i++) {
    const row = items[i]
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const asin = String(p.asin ?? p.ASIN ?? "").trim()
    const summaries = p.summaries as Array<Record<string, unknown>> | undefined
    const title = String(summaries?.[0]?.itemName ?? p.title ?? "").trim()
    if (!asin || !title) continue
    out.push(
      baseProduct({
        marketplaceId: "amazon",
        externalId: asin,
        title,
        price: 0,
        currency: country === "FR" || country === "DE" ? "EUR" : "USD",
        rank: i + 1,
        category,
        country,
        salesEst: null,
        imageUrl: null,
        url: `https://${AMAZON_HOST[country] ?? "www.amazon.com"}/dp/${asin}`,
      })
    )
  }
  return out
}

async function crawlAmazonScrape(category: string, country: string): Promise<GlobalProduct[]> {
  const host = AMAZON_HOST[country.toUpperCase()] ?? AMAZON_HOST.US
  const bsPath = AMAZON_BESTSELLER_PATH[category] ?? category
  const url = `https://${host}/gp/bestsellers/${encodeURIComponent(bsPath)}`

  const res = await radarFetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
  })

  if (!res.ok) {
    console.log("[radar/crawler]", {
      marketplaceId: "amazon",
      result: "scrape_http_error",
      status: res.status,
      category,
      country,
    })
    return []
  }

  const html = await res.text()
  const $ = cheerio.load(html)
  const out: GlobalProduct[] = []
  const currency = country === "FR" || country === "DE" || country === "UK" || country === "GB" ? (country === "UK" || country === "GB" ? "GBP" : "EUR") : "USD"

  $("[data-asin]").each((i, el) => {
    if (out.length >= TOP_N) return
    const asin = ($(el).attr("data-asin") ?? "").trim()
    if (!asin || asin.length < 8) return
    const title =
      $(el).find("img").attr("alt")?.trim() ||
      $(el).find(".p13n-sc-truncate, .a-link-normal span div").first().text().trim() ||
      ""
    if (!title) return
    const priceText = $(el).find(".p13n-sc-price, .a-price .a-offscreen").first().text().trim()
    const price = Number(priceText.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    const imageUrl = $(el).find("img").attr("src") ?? null
    out.push(
      baseProduct({
        marketplaceId: "amazon",
        externalId: asin,
        title,
        price,
        currency,
        rank: i + 1,
        category,
        country: country.toUpperCase(),
        salesEst: null,
        imageUrl,
        url: `https://${host}/dp/${asin}`,
      })
    )
  })

  console.log("[radar/crawler]", {
    marketplaceId: "amazon",
    result: "bestsellers_scrape_ok",
    category,
    country,
    count: out.length,
  })
  return out.slice(0, TOP_N)
}

/**
 * Crawl marketplace best-sellers for a category/country.
 * TikTok: trending API (token optional). Amazon: SP-API if configured, else HTML scrape.
 */
export async function crawlBestSellers(
  marketplaceId: string,
  category: string,
  country: string
): Promise<GlobalProduct[]> {
  const id = marketplaceId.trim().toLowerCase()
  const cat = category.trim().toLowerCase()
  const cc = country.trim().toUpperCase() || "US"

  if (id === "tiktok_shop" || id === "tiktok") {
    return crawlTikTokBestSellers(cat, cc)
  }

  if (id === "amazon") {
    const viaSp = await crawlAmazonSpApi(cat, cc)
    if (viaSp !== null) {
      console.log("[radar/crawler]", {
        marketplaceId: "amazon",
        result: "bestsellers_sp_api_ok",
        category: cat,
        country: cc,
        count: viaSp.length,
      })
      return viaSp.slice(0, TOP_N)
    }
    return crawlAmazonScrape(cat, cc)
  }

  console.log("[radar/crawler]", {
    marketplaceId: id,
    result: "bestsellers_unsupported",
    category: cat,
    country: cc,
  })
  return []
}
