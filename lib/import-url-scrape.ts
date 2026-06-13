import * as cheerio from "cheerio"

import { catalogHexForColorName } from "@/lib/color-name-hex"

export type ImportPlatform =
  | "aliexpress"
  | "1688"
  | "amazon"
  | "shopify"
  | "shein"
  | "temu"
  | "universal"

const PLACEHOLDER_SCRAPINGBEE_KEYS = new Set([
  "",
  "free_key_here",
  "your_api_key",
  "changeme",
])

export function detectImportPlatform(url: string): ImportPlatform {
  const host = url.toLowerCase()
  if (host.includes("aliexpress.com")) return "aliexpress"
  if (host.includes("1688.com")) return "1688"
  if (host.includes("amazon.")) return "amazon"
  if (host.includes("/products/") || host.includes("myshopify.com")) return "shopify"
  if (host.includes("shein.com")) return "shein"
  if (host.includes("temu.com")) return "temu"
  return "universal"
}

/** Canonical product URL (stable item id, locale host preserved). */
export function normalizeImportUrl(url: string, platform: ImportPlatform): string {
  if (platform !== "aliexpress") return url.trim()
  try {
    const u = new URL(url.trim())
    const itemMatch = u.pathname.match(/\/item\/(\d+)\.html/i)
    if (!itemMatch?.[1]) return url.trim()
    const host = u.hostname.toLowerCase()
    const locale = host.match(/^([a-z]{2})\.aliexpress\.com$/)?.[1]
    const origin =
      locale && locale !== "www"
        ? `https://${locale}.aliexpress.com`
        : "https://www.aliexpress.com"
    const qs = u.searchParams.toString()
    return `${origin}/item/${itemMatch[1]}.html${qs ? `?${qs}` : ""}`
  } catch {
    return url.trim()
  }
}

export function aliExpressCountryCode(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase()
    const locale = host.match(/^([a-z]{2})\.aliexpress\.com$/)?.[1]
    if (locale && locale !== "www") return locale
  } catch {
    /* ignore */
  }
  return "us"
}

export function getScrapingBeeApiKey(): string | null {
  const key = process.env.SCRAPINGBEE_API_KEY?.trim()
  if (!key || PLACEHOLDER_SCRAPINGBEE_KEYS.has(key.toLowerCase())) return null
  return key
}

export function scrapingBeeMissingMessage(platform: ImportPlatform): string {
  if (platform === "aliexpress") {
    return "AliExpress : utilisez l’onglet AliExpress (API officielle), pas Product URL / ScrapingBee."
  }
  return "Import blocked by the store. Set SCRAPINGBEE_API_KEY in environment variables (scrapingbee.com)."
}

type ScrapingBeeStrategy = {
  label: string
  params: Record<string, string>
}

function scrapingBeeStrategies(url: string, platform: ImportPlatform): ScrapingBeeStrategy[] {
  const country = platform === "aliexpress" ? aliExpressCountryCode(url) : "us"
  const base: Record<string, string> = {
    country_code: country,
    block_resources: "false",
  }
  if (platform === "aliexpress") {
    return [
      {
        label: "stealth+js",
        params: {
          ...base,
          render_js: "true",
          stealth_proxy: "true",
          wait: "8000",
          wait_browser: "networkidle2",
        },
      },
      {
        label: "premium+js",
        params: {
          ...base,
          render_js: "true",
          premium_proxy: "true",
          wait: "8000",
          wait_browser: "networkidle2",
        },
      },
      {
        label: "js",
        params: {
          ...base,
          render_js: "true",
          wait: "6000",
        },
      },
      {
        label: "premium",
        params: {
          ...base,
          premium_proxy: "true",
        },
      },
    ]
  }
  return [
    {
      label: "stealth+js",
      params: { ...base, render_js: "true", stealth_proxy: "true", wait: "5000" },
    },
    {
      label: "premium+js",
      params: { ...base, render_js: "true", premium_proxy: "true", wait: "5000" },
    },
  ]
}

async function readScrapingBeeError(res: Response, body: string): Promise<string> {
  try {
    const j = JSON.parse(body) as { message?: string; error?: string; reason?: string }
    const msg = j.message ?? j.error ?? j.reason
    if (msg) return msg
  } catch {
    /* plain text body */
  }
  if (res.status === 401) {
    return "Invalid SCRAPINGBEE_API_KEY — check the key in Vercel environment variables"
  }
  if (res.status === 402) {
    return "ScrapingBee credits exhausted — upgrade your plan or wait for the monthly reset"
  }
  if (res.status === 429) {
    return "ScrapingBee rate limit — wait a minute and try again"
  }
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 180)
  return snippet ? `ScrapingBee HTTP ${res.status}: ${snippet}` : `ScrapingBee HTTP ${res.status}`
}

/** Fetch rendered HTML via ScrapingBee with fallback proxy strategies. */
export async function fetchHtmlWithScrapingBee(
  url: string,
  platform: ImportPlatform,
  apiKey: string
): Promise<{ html: string; strategy: string }> {
  const strategies = scrapingBeeStrategies(url, platform)
  const errors: string[] = []

  for (const { label, params } of strategies) {
    const qs = new URLSearchParams({
      api_key: apiKey,
      url,
      ...params,
    })
    try {
      const res = await fetch(`https://app.scrapingbee.com/api/v1/?${qs}`, {
        signal: AbortSignal.timeout(60_000),
      })
      const body = await res.text()
      if (!res.ok) {
        errors.push(`${label}: ${await readScrapingBeeError(res, body)}`)
        continue
      }
      if (body.length < 500) {
        errors.push(`${label}: empty or blocked response`)
        continue
      }
      return { html: body, strategy: label }
    } catch (e: unknown) {
      errors.push(`${label}: ${e instanceof Error ? e.message : "network error"}`)
    }
  }

  throw new Error(
    errors.length > 0
      ? `ScrapingBee failed (${errors.join("; ")})`
      : "ScrapingBee failed"
  )
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function hdImage(raw: string): string {
  const s = raw.trim()
  if (!s) return ""
  const withProto = /^https?:/i.test(s) ? s : `https:${s}`
  return withProto.replace(/_\d+x\d+\./, "_960x960.")
}

function parseBalancedObjectLiteral(html: string, startIndex: number): Record<string, unknown> | null {
  if (html[startIndex] !== "{") return null
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
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(startIndex, i + 1)) as Record<string, unknown>
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/** Extract `window.VAR = {...};` JSON from inline scripts (balanced braces for large blobs). */
export function extractWindowJson(html: string, varNames: string[]): Record<string, unknown> | null {
  for (const name of varNames) {
    const marker = `window.${name} = `
    let from = 0
    while (from < html.length) {
      const idx = html.indexOf(marker, from)
      if (idx === -1) break
      const start = idx + marker.length
      const parsed = parseBalancedObjectLiteral(html, start)
      if (parsed && Object.keys(parsed).length > 0) return parsed
      from = start + 1
    }
  }
  return null
}

/** Scan HTML for common AliExpress price fields when structured modules are missing. */
export function extractAliExpressPriceFromHtml(html: string): number {
  const patterns = [
    /"actMinPrice"\s*:\s*"?([\d.]+)"?/i,
    /"skuActivityAmount"\s*:\s*\{\s*"value"\s*:\s*"?([\d.]+)"?/i,
    /"skuAmount"\s*:\s*\{\s*"value"\s*:\s*"?([\d.]+)"?/i,
    /"minPrice"\s*:\s*([\d.]+)/i,
    /"cent"\s*:\s*(\d{3,8})\b/,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (!m?.[1]) continue
    let n = parseFloat(m[1])
    if (!Number.isFinite(n) || n <= 0) continue
    if (re.source.includes("cent") && n > 1000) n = n / 100
    if (n > 0 && n < 1_000_000) return Math.round(n * 100) / 100
  }
  return 0
}

export type AliExpressParseInput = {
  title: string
  description: string
  price: number
  original_price: number
  images: string[]
  brand: string
  sku: string
  stock: number
  variants: Array<{
    name: string
    type: string
    image: string
    price: number
    stock: number
    sku: string
    attributes: Record<string, string>
  }>
  colors: Array<{ name: string; image: string; hex: string }>
  sizes: Array<{ name: string; value: string }>
  videos: string[]
  reviews: {
    total: number
    average_rating: number
  }
  shipping: {
    from_country: string
    delivery_time: string
  }
}

/** Parse AliExpress HTML using __AER_DATA__, legacy blobs, or Open Graph / JSON-LD. */
export function parseAliExpressHtml(html: string, url: string): AliExpressParseInput | null {
  const aer = extractWindowJson(html, ["__AER_DATA__"])
  if (aer) {
    const fromAer = parseAerData(aer, url)
    if (fromAer.title) return fromAer
  }

  const legacy = extractWindowJson(html, ["__INIT_DATA__", "runParams"])
  if (legacy) {
    const fromLegacy = parseAliExpressLegacyBlob(legacy, url)
    if (fromLegacy.title) return fromLegacy
  }

  const fromMeta = parseAliExpressOpenGraph(html, url)
  if (fromMeta.title) {
    if (!fromMeta.price) {
      const scraped = extractAliExpressPriceFromHtml(html)
      if (scraped > 0) {
        fromMeta.price = scraped
        fromMeta.original_price = scraped
      }
    }
    return fromMeta
  }

  return null
}

function parseAerData(aerData: Record<string, unknown>, url: string): AliExpressParseInput {
  const p = asRec(aerData.pageModule)
  const productInfo = asRec(asRec(p.productInfoComponent).productInfo)
  const skuModule = asRec(asRec(p.skuComponent).skuModule)
  const reviewModule = asRec(asRec(p.reviewComponent).reviewModule)
  const shippingModule = asRec(asRec(p.shippingComponent).shippingModule)
  const freightInfo = asRec(shippingModule.generalFreightInfo)

  const skuPriceList = Array.isArray(skuModule.skuPriceList) ? skuModule.skuPriceList : []
  const prices = skuPriceList
    .map((row) => {
      const skuVal = asRec(asRec(row).skuVal)
      return (
        num(asRec(skuVal.skuActivityAmount).value) || num(asRec(skuVal.skuAmount).value)
      )
    })
    .filter((v) => v > 0)

  const variants = (Array.isArray(skuModule.productSKUPropertyList)
    ? skuModule.productSKUPropertyList
    : []
  ).flatMap((propRaw) => {
    const prop = asRec(propRaw)
    const propName = txt(prop.skuPropertyName)
    const values = Array.isArray(prop.skuPropertyValues) ? prop.skuPropertyValues : []
    return values.map((vRaw) => {
      const v = asRec(vRaw)
      const name = txt(v.propertyValueDisplayName)
      return {
        name,
        type: propName,
        image: txt(v.skuPropertyImagePath) ? hdImage(txt(v.skuPropertyImagePath)) : "",
        price: prices[0] || 0,
        stock: 50,
        sku: `AE-${txt(v.propertyValueId)}`,
        attributes: { [propName]: name },
      }
    })
  })

  const mediaModule = asRec(p.mediaComponent)
  const videoPath = txt(asRec(mediaModule).videoPath) || txt(productInfo.videoPath)
  const videos: string[] = []
  if (videoPath) videos.push(hdImage(videoPath))

  const itemId = url.match(/item\/(\d+)\.html/)?.[1] ?? ""

  return {
    title: txt(productInfo.subject),
    description: txt(productInfo.description),
    price: prices.length ? Math.min(...prices) : 0,
    original_price: prices.length ? Math.max(...prices) : 0,
    images: (Array.isArray(productInfo.imagePathList) ? productInfo.imagePathList : [])
      .filter((i): i is string => typeof i === "string")
      .map((i) => hdImage(i))
      .slice(0, 12),
    brand: txt(productInfo.storeName),
    sku: `AE-${itemId}`,
    stock: num(productInfo.totalAvailQuantity) || 999,
    variants,
    colors: variants
      .filter((v) => v.type.toLowerCase().includes("color"))
      .map((v) => ({ name: v.name, image: v.image, hex: catalogHexForColorName(v.name) })),
    sizes: variants
      .filter((v) => v.type.toLowerCase().includes("size"))
      .map((v) => ({ name: v.name, value: v.name })),
    videos,
    reviews: {
      total: Math.max(0, Math.round(num(reviewModule.totalValidNum))),
      average_rating: num(reviewModule.averageStar),
    },
    shipping: {
      from_country: txt(freightInfo.shipFrom) || "China",
      delivery_time: txt(freightInfo.deliveryTimeDesc) || "15-25 days",
    },
  }
}

function parseAliExpressLegacyBlob(
  data: Record<string, unknown>,
  url: string
): AliExpressParseInput {
  const empty = parseAliExpressOpenGraph("", url)
  const nested = asRec(data.data)
  const pageModule = asRec(data.pageModule ?? nested.pageModule ?? data)
  if (pageModule.pageModule) {
    return parseAerData({ pageModule: pageModule.pageModule }, url)
  }
  if (pageModule.productInfoComponent || pageModule.skuComponent) {
    return parseAerData({ pageModule }, url)
  }

  const items = Array.isArray(data.items) ? data.items : []
  const first = asRec(items[0])
  const title = txt(asRec(first.title).displayTitle) || txt(first.subject) || txt(first.title)
  const image = asRec(first.image)
  const imgUrl = txt(image.imgUrl)
  const prices = asRec(first.prices)
  const sale = asRec(prices.salePrice)
  const original = asRec(prices.originalPrice)
  const price = num(sale.minPrice) || num(sale.cent) / 100 || num(original.minPrice)

  return {
    ...empty,
    title,
    price,
    original_price: num(original.minPrice) || price,
    images: imgUrl ? [hdImage(imgUrl)] : [],
    sku: `AE-${url.match(/item\/(\d+)\.html/)?.[1] ?? ""}`,
  }
}

function parseAliExpressOpenGraph(html: string, url: string): AliExpressParseInput {
  const $ = cheerio.load(html)
  const itemId = url.match(/item\/(\d+)\.html/)?.[1] ?? ""

  let title =
    txt($('meta[property="og:title"]').attr("content")) ||
    txt($("h1").first().text()) ||
    txt($('meta[name="title"]').attr("content"))

  if (title.includes("|")) title = title.split("|")[0]!.trim()
  if (title.toLowerCase().includes("aliexpress")) {
    title = title.replace(/\s*[-–|]\s*Aliexpress.*$/i, "").trim()
  }

  const description =
    txt($('meta[property="og:description"]').attr("content")) ||
    txt($('meta[name="description"]').attr("content"))

  const priceRaw =
    txt($('meta[property="product:price:amount"]').attr("content")) ||
    txt($('meta[itemprop="price"]').attr("content"))
  let price = num(priceRaw)
  if (price > 10_000) price = price / 100

  const images: string[] = []
  const ogImg = txt($('meta[property="og:image"]').attr("content"))
  if (ogImg) images.push(hdImage(ogImg))
  $('meta[property="og:image:url"]').each((_, el) => {
    const c = txt($(el).attr("content"))
    if (c) images.push(hdImage(c))
  })

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() || ""
    if (!text.trim()) return
    try {
      const parsed = JSON.parse(text) as unknown
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of list) {
        const p = asRec(node)
        const type = p["@type"]
        if (type !== "Product" && !(Array.isArray(type) && type.includes("Product"))) continue
        if (!title) title = txt(p.name)
        const offers = asRec(p.offers)
        if (!price) price = num(offers.price ?? offers.lowPrice)
        const img = p.image
        if (typeof img === "string") images.push(hdImage(img))
        else if (Array.isArray(img)) {
          for (const i of img) {
            if (typeof i === "string") images.push(hdImage(i))
          }
        }
      }
    } catch {
      /* ignore */
    }
  })

  return {
    title,
    description,
    price,
    original_price: price,
    images: [...new Set(images.filter(Boolean))].slice(0, 12),
    brand: "",
    sku: `AE-${itemId}`,
    stock: 999,
    variants: [],
    colors: [],
    sizes: [],
    videos: [],
    reviews: { total: 0, average_rating: 0 },
    shipping: { from_country: "China", delivery_time: "15-25 days" },
  }
}
