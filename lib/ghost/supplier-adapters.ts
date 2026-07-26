import { getScrapingBeeApiKey } from "@/lib/import-url-scrape"
import {
  GHOST_CHECK_TIMEOUT_MS,
  GHOST_LOW_STOCK_THRESHOLD,
  type GhostSupplierSource,
  type StockResult,
} from "@/lib/ghost/types"

function parsePriceFromHtml(html: string): number {
  const patterns = [
    /"price"\s*:\s*"?([\d]+(?:[.,]\d{1,2})?)"?/i,
    /"amount"\s*:\s*"?([\d]+(?:[.,]\d{1,2})?)"?/i,
    /itemprop="price"[^>]*content="([\d.]+)"/i,
    /€\s*([\d]+(?:[.,]\d{1,2})?)/,
    /([\d]+(?:[.,]\d{1,2})?)\s*€/,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (!m?.[1]) continue
    const n = parseFloat(m[1].replace(",", "."))
    if (Number.isFinite(n) && n > 0 && n < 100_000) return n
  }
  return 0
}

function parseStockStatusFromHtml(html: string): StockResult["status"] {
  const lower = html.toLowerCase()
  if (
    /out of stock|rupture|sold out|indisponible|currently unavailable|no longer available/i.test(
      lower
    )
  ) {
    return "out_of_stock"
  }
  const onlyLeft = html.match(/only\s+(\d+)\s+left/i) || html.match(/plus que\s+(\d+)/i)
  if (onlyLeft?.[1]) {
    const n = parseInt(onlyLeft[1], 10)
    if (Number.isFinite(n) && n > 0 && n < GHOST_LOW_STOCK_THRESHOLD) return "low_stock"
  }
  if (/in stock|en stock|add to cart|ajouter au panier|buy now/i.test(lower)) {
    return "in_stock"
  }
  return "in_stock"
}

async function fetchHtmlViaScrapingBee(url: string): Promise<string | null> {
  const key = getScrapingBeeApiKey()
  if (!key) return null
  const qs = new URLSearchParams({
    api_key: key,
    url,
    render_js: "false",
    premium_proxy: "false",
    country_code: "fr",
  })
  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${qs}`, {
    signal: AbortSignal.timeout(GHOST_CHECK_TIMEOUT_MS),
  })
  if (!res.ok) return null
  const html = await res.text()
  return html.length > 200 ? html : null
}

async function fetchHtmlDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AffisellGhost/1.0; +https://affisell.com)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(GHOST_CHECK_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 200 ? html : null
  } catch {
    return null
  }
}

async function scrapeStockPage(
  url: string,
  source: GhostSupplierSource
): Promise<StockResult | null> {
  const html =
    (await fetchHtmlViaScrapingBee(url).catch(() => null)) ||
    (await fetchHtmlDirect(url))
  if (!html) return null
  const status = parseStockStatusFromHtml(html)
  const price = parsePriceFromHtml(html)
  return {
    status,
    price,
    checkedAt: new Date(),
    source: `${source}:scrape`,
    estimatedDeliveryDays: source === "amazon" ? 3 : 15,
  }
}

function buildAliExpressUrl(idOrUrl: string): string {
  if (/^https?:\/\//i.test(idOrUrl)) return idOrUrl
  return `https://www.aliexpress.com/item/${idOrUrl}.html`
}

export async function aliexpressCheck(args: {
  supplierProductId?: string | null
  supplierUrl?: string | null
}): Promise<StockResult | null> {
  const url =
    args.supplierUrl?.trim() ||
    (args.supplierProductId ? buildAliExpressUrl(args.supplierProductId) : "")
  if (!url) return null
  return scrapeStockPage(url, "aliexpress")
}

export async function temuCheck(args: {
  supplierUrl?: string | null
}): Promise<StockResult | null> {
  const url = args.supplierUrl?.trim()
  if (!url) return null
  return scrapeStockPage(url, "temu")
}

export async function amazonCheck(args: {
  supplierUrl?: string | null
}): Promise<StockResult | null> {
  const url = args.supplierUrl?.trim()
  if (!url) return null
  return scrapeStockPage(url, "amazon")
}

export function detectGhostSupplierSource(
  url: string | null | undefined,
  importSource?: string | null
): GhostSupplierSource | null {
  const u = (url || "").toLowerCase()
  const src = (importSource || "").toLowerCase()
  if (u.includes("aliexpress") || src.includes("aliexpress")) return "aliexpress"
  if (u.includes("temu") || src.includes("temu")) return "temu"
  if (u.includes("amazon") || u.includes("amzn.") || src.includes("amazon")) return "amazon"
  return null
}
