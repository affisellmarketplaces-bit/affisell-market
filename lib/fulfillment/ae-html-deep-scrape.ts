import { parseAeSkusFromPagePayload, type AePageParseResult } from "@/lib/fulfillment/ae-page-skus"
import { normalizeAeSkuCandidate } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function txt(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return ""
}

/** Decode common encodings in saved AE pages (Safari/Chrome). */
export function normalizeHtmlForJsonScan(html: string): string {
  return html
    .replace(/\\u0022/gi, '"')
    .replace(/\\u003a/gi, ":")
    .replace(/\\u002c/gi, ",")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
}

function parseBalancedJsonValue(
  html: string,
  startIndex: number,
  openChar: "{" | "["
): unknown | null {
  const closeChar = openChar === "{" ? "}" : "]"
  if (html[startIndex] !== openChar) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIndex; i < html.length; i++) {
    const c = html[i]!
    if (inString) {
      if (escape) escape = false
      else if (c === "\\") escape = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === openChar) depth++
    else if (c === closeChar) {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(startIndex, i + 1)) as unknown
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function findArraysAfterKey(html: string, key: string): unknown[][] {
  const out: unknown[][] = []
  const needles = [`"${key}"`, `'${key}'`, key]
  for (const needle of needles) {
    let pos = 0
    while (pos < html.length) {
      const idx = html.indexOf(needle, pos)
      if (idx < 0) break
      const colon = html.indexOf(":", idx + needle.length)
      if (colon < 0 || colon - idx > 40) {
        pos = idx + needle.length
        continue
      }
      let bracket = colon + 1
      while (bracket < html.length && /[\s\n\r]/.test(html[bracket]!)) bracket++
      if (html[bracket] !== "[") {
        pos = idx + needle.length
        continue
      }
      const arr = parseBalancedJsonValue(html, bracket, "[")
      if (Array.isArray(arr) && arr.length > 0) out.push(arr)
      pos = bracket + 1
    }
  }
  return out
}

function tryParseEmbeddedBlobs(html: string, url: string): AePageParseResult | null {
  const markers = [
    "window.__AER_DATA__ = ",
    "window.__AER_DATA__=",
    "var __AER_DATA__ = ",
    "__AER_DATA__=",
    "window.__INIT_DATA__ = ",
    "window.runParams = ",
    "runParams = ",
  ]

  for (const marker of markers) {
    let from = 0
    while (from < html.length) {
      const idx = html.indexOf(marker, from)
      if (idx < 0) break
      let start = idx + marker.length
      while (start < html.length && /[\s\n\r]/.test(html[start]!)) start++
      const open = html[start]
      if (open !== "{" && open !== "[") {
        from = start + 1
        continue
      }
      const parsed = parseBalancedJsonValue(html, start, open === "[" ? "[" : "{")
      if (parsed) {
        const fromPayload = parseAeSkusFromPagePayload(parsed, { url })
        if (fromPayload.aeSkus.length > 0) return fromPayload
        const rec = asRec(parsed)
        if (rec?.data) {
          const nested = parseAeSkusFromPagePayload(rec.data, { url })
          if (nested.aeSkus.length > 0) return nested
        }
      }
      from = start + 1
    }
  }
  return null
}

function buildPayloadFromSkuLists(
  skuLists: unknown[][],
  propertyLists: unknown[][],
  url: string
): AePageParseResult | null {
  const productSKUPropertyList =
    propertyLists.find((p) => p.length > 0) ?? ([] as unknown[])
  const skuPriceList = skuLists.flat()

  if (skuPriceList.length === 0) return null

  const parsed = parseAeSkusFromPagePayload(
    {
      pageModule: {
        productInfoComponent: { productInfo: { storeId: "", subject: "" } },
        skuComponent: {
          skuModule: {
            productSKUPropertyList,
            skuPriceList,
          },
        },
      },
    },
    { url }
  )

  return parsed.aeSkus.length > 0 ? parsed : null
}

function scrapeSkuIdsByRegex(html: string): AeProductSkuRow[] {
  const rows: AeProductSkuRow[] = []
  const seen = new Set<string>()

  const patterns = [
    /"skuId"\s*:\s*"?(\d{10,22})"?/gi,
    /"sku_id"\s*:\s*"?(\d{10,22})"?/gi,
    /"skuIdStr"\s*:\s*"?(\d{10,22})"?/gi,
    /skuId["']?\s*[:=]\s*["']?(\d{10,22})/gi,
  ]

  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const id = normalizeAeSkuCandidate(m[1] ?? "")
      if (!id || seen.has(id)) continue
      seen.add(id)
      rows.push({
        aeSkuId: id,
        aeLabel: id,
        matchColor: null,
        matchSize: null,
        aePriceCents: 0,
        stock: 0,
      })
    }
  }

  const priceRe = /"skuActivityAmount"\s*:\s*\{\s*"value"\s*:\s*"?([\d.]+)"?/gi
  const prices: number[] = []
  for (const m of html.matchAll(priceRe)) {
    const n = Number(m[1])
    if (n > 0) prices.push(Math.max(100, Math.round(n * 100)))
  }
  if (prices.length > 0 && rows.length > 0) {
    const minPrice = Math.min(...prices)
    return rows.map((r, i) => ({
      ...r,
      aePriceCents: prices[i] ?? minPrice,
    }))
  }

  return rows
}

/**
 * Aggressive parse for browser-saved .html (often without inline __AER_DATA__).
 */
export function parseAeCatalogFromHtmlDeep(html: string, url: string): AePageParseResult {
  const normalized = normalizeHtmlForJsonScan(html)

  const fromBlob = tryParseEmbeddedBlobs(normalized, url)
  if (fromBlob && fromBlob.aeSkus.length > 0) return fromBlob

  const skuLists = findArraysAfterKey(normalized, "skuPriceList")
  const propertyLists = findArraysAfterKey(normalized, "productSKUPropertyList")
  const fromLists = buildPayloadFromSkuLists(skuLists, propertyLists, url)
  if (fromLists && fromLists.aeSkus.length > 0) return fromLists

  const regexSkus = scrapeSkuIdsByRegex(normalized)
  if (regexSkus.length > 0) {
    const prices = regexSkus.map((s) => s.aePriceCents).filter((p) => p > 0)
    return {
      aeSkus: regexSkus,
      aePriceCents: prices.length > 0 ? Math.min(...prices) : 0,
      aeShopId: "",
      title: "",
    }
  }

  return { aeSkus: [], aePriceCents: 0, aeShopId: "", title: "" }
}
