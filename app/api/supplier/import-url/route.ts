import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

import { prisma } from "@/lib/prisma"

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY

type ReviewSentiment = "positive" | "neutral" | "negative"

type ImportedReview = {
  rating: number
  author: string
  country: string
  date: string
  text: string
  images: string[]
  variant: string
  helpful_count: number
  verified: boolean
  sentiment: ReviewSentiment
}

type ImportedProduct = {
  title: string
  description: string
  ai_title: string
  ai_description: string
  price: number
  original_price: number
  currency: string
  images: string[]
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
  brand: string
  category: string
  sku: string
  stock: number
  shipping: {
    from_country: string
    delivery_time: string
    shipping_cost: number
    carrier: string
  }
  reviews: {
    total: number
    average_rating: number
    breakdown: Record<number, number>
    items: ImportedReview[]
    sentiment: ReviewSentiment
  }
  specs: Record<string, string>
  source_platform: string
  source_url: string
  basePrice: number
  costPrice: number
  suggested_price: number
  suggested_commission: number
  profit_per_sale: number
  roi: number
  tags: string[]
  quality_score: number
  is_duplicate: boolean
  seo_keywords: string[]
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
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

function detectPlatform(url: string): string {
  if (url.includes("aliexpress.com")) return "aliexpress"
  if (url.includes("amazon.")) return "amazon"
  if (url.includes("/products/") || url.includes("myshopify.com")) return "shopify"
  if (url.includes("shein.com")) return "shein"
  if (url.includes("temu.com")) return "temu"
  return "universal"
}

function parseDate(raw: string): string {
  const d = new Date(raw)
  if (Number.isFinite(d.getTime())) return d.toISOString()
  return new Date().toISOString()
}

function sentimentFromRating(rating: number): ReviewSentiment {
  if (rating >= 4) return "positive"
  if (rating >= 3) return "neutral"
  return "negative"
}

function globalSentiment(avg: number): ReviewSentiment {
  if (avg >= 4) return "positive"
  if (avg >= 3) return "neutral"
  return "negative"
}

function extractJsonAfterKey(
  content: string,
  keyRx: RegExp
): Record<string, unknown> | null {
  const m = keyRx.exec(content)
  if (!m || m.index === undefined) return null
  const start = content.indexOf("{", m.index)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < content.length; i++) {
    const c = content[i]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(content.slice(start, i + 1)) as Record<string, unknown>
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function extractAERData(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html)
  for (const script of $("script").toArray()) {
    const content = $(script).html() || ""
    if (!content.includes("__AER_DATA__")) continue
    const parsed =
      extractJsonAfterKey(content, /window\.__AER_DATA__\s*=/) ??
      extractJsonAfterKey(content, /window\[['"]__AER_DATA__['"]\]\s*=/)
    if (parsed) return parsed
  }
  return null
}

function baselineProduct(url: string, platform: string): ImportedProduct {
  return {
    title: "",
    description: "",
    ai_title: "",
    ai_description: "",
    price: 0,
    original_price: 0,
    currency: "USD",
    images: [],
    variants: [],
    colors: [],
    sizes: [],
    brand: "",
    category: "",
    sku: "",
    stock: 0,
    shipping: {
      from_country: "Unknown",
      delivery_time: "7-14 days",
      shipping_cost: 0,
      carrier: "",
    },
    reviews: {
      total: 0,
      average_rating: 0,
      breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      items: [],
      sentiment: "neutral",
    },
    specs: {},
    source_platform: platform,
    source_url: url,
    basePrice: 0,
    costPrice: 0,
    suggested_price: 0,
    suggested_commission: 25,
    profit_per_sale: 0,
    roi: 0,
    tags: [],
    quality_score: 0,
    is_duplicate: false,
    seo_keywords: [],
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      url?: string
      ai_rewrite?: boolean
      markup_calc?: boolean
    }
    const url = typeof body.url === "string" ? body.url.trim() : ""
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }

    const ai_rewrite = body.ai_rewrite === true
    const markup_calc = body.markup_calc !== false

    const platform = detectPlatform(url)

    let product: ImportedProduct
    if (platform === "aliexpress") {
      product = await scrapeAliExpressRobust(url)
    } else if (platform === "amazon") {
      product = await scrapeAmazon(url)
    } else if (platform === "shopify") {
      product = await scrapeShopify(url)
    } else {
      product = await scrapeUniversal(url)
    }

    if (!product.title) throw new Error("Failed to extract product data")

    product.quality_score = calculateQualityScore(product)
    product.is_duplicate = await checkDuplicate(product)
    product.seo_keywords = generateSEOKeywords(product.title, product.reviews.items)

    if (markup_calc) {
      product.suggested_price = Math.ceil(product.price * 2.5 * 100) / 100
      product.suggested_commission = 25
      product.profit_per_sale = product.suggested_price - product.price
      product.roi =
        product.price > 0
          ? Math.round((product.profit_per_sale / product.price) * 100)
          : 0
      product.basePrice = product.suggested_price
      product.costPrice = product.price
    }

    if (ai_rewrite) {
      product.ai_title = await rewriteTitle(product.title)
      product.ai_description = await rewriteDescription(product.description)
    }

    return NextResponse.json({ products: [product], success: true, platform })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed",
        fallback:
          "Try using a VPN or contact support. AliExpress may be blocking your IP.",
      },
      { status: 422 }
    )
  }
}

async function fetchDirect(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Ch-Ua":
        '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Blocked: ${res.status}`)
  return res.text()
}

async function scrapeAliExpressRobust(url: string): Promise<ImportedProduct> {
  try {
    const html = await fetchDirect(url)
    const data = extractAERData(html)
    if (data) return parseAERData(data, url)
  } catch {
    /* fallback to ScrapingBee */
  }

  if (!SCRAPINGBEE_API_KEY) {
    throw new Error(
      "AliExpress blocked. Add SCRAPINGBEE_API_KEY to .env.local to bypass. Free tier: 1000 calls/month"
    )
  }

  const beeUrl =
    `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(
      SCRAPINGBEE_API_KEY
    )}` +
    `&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true&country_code=us`

  const res = await fetch(beeUrl, { signal: AbortSignal.timeout(45000) })
  if (!res.ok) throw new Error(`ScrapingBee failed: ${res.status}`)

  const html = await res.text()
  const data = extractAERData(html)
  if (!data) throw new Error("__AER_DATA__ not found even with proxy")
  return parseAERData(data, url)
}

function parseAERData(aerData: Record<string, unknown>, url: string): ImportedProduct {
  const p = asRec(aerData.pageModule)
  const productInfo = asRec(asRec(p.productInfoComponent).productInfo)
  const skuModule = asRec(asRec(p.skuComponent).skuModule)
  const reviewModule = asRec(asRec(p.reviewComponent).reviewModule)
  const shippingModule = asRec(asRec(p.shippingComponent).shippingModule)
  const freightInfo = asRec(shippingModule.generalFreightInfo)

  const out = baselineProduct(url, "aliexpress")
  const skuPriceList = Array.isArray(skuModule.skuPriceList)
    ? skuModule.skuPriceList
    : []
  const prices = skuPriceList
    .map((row) => {
      const skuVal = asRec(asRec(row).skuVal)
      return (
        num(asRec(skuVal.skuActivityAmount).value) ||
        num(asRec(skuVal.skuAmount).value)
      )
    })
    .filter((v) => v > 0)

  out.title = txt(productInfo.subject)
  out.description = txt(productInfo.description)
  out.price = prices.length ? Math.min(...prices) : 0
  out.original_price = prices.length ? Math.max(...prices) : out.price
  out.currency = "USD"
  out.images = (Array.isArray(productInfo.imagePathList)
    ? productInfo.imagePathList
    : []
  )
    .filter((i): i is string => typeof i === "string")
    .map((i) => hdImage(i))
    .slice(0, 10)
  out.brand = txt(productInfo.storeName)
  out.sku = `AE-${url.match(/item\/(\d+)\.html/)?.[1] ?? ""}`
  out.stock = num(productInfo.totalAvailQuantity) || 999

  const variants = (Array.isArray(skuModule.productSKUPropertyList)
    ? skuModule.productSKUPropertyList
    : []
  ).flatMap((propRaw) => {
    const prop = asRec(propRaw)
    const propName = txt(prop.skuPropertyName)
    const values = Array.isArray(prop.skuPropertyValues)
      ? prop.skuPropertyValues
      : []
    return values.map((vRaw) => {
      const v = asRec(vRaw)
      const name = txt(v.propertyValueDisplayName)
      const image = txt(v.skuPropertyImagePath)
        ? hdImage(txt(v.skuPropertyImagePath))
        : ""
      return {
        name,
        type: propName,
        image,
        price: prices[0] || 0,
        stock: 999,
        sku: `AE-${txt(v.propertyValueId)}`,
        attributes: { [propName]: name },
      }
    })
  })
  out.variants = variants
  out.colors = variants
    .filter((v) => v.type.toLowerCase().includes("color"))
    .map((v) => ({ name: v.name, image: v.image, hex: "#CCCCCC" }))
  out.sizes = variants
    .filter((v) => v.type.toLowerCase().includes("size"))
    .map((v) => ({ name: v.name, value: v.name }))

  out.shipping = {
    from_country: txt(freightInfo.shipFrom) || "China",
    delivery_time: txt(freightInfo.deliveryTimeDesc) || "15-25 days",
    shipping_cost: 0,
    carrier: "Standard",
  }

  const starLevel = asRec(reviewModule.starLevel)
  const avg = num(reviewModule.averageStar)
  const reviewItemsRaw = Array.isArray(reviewModule.reviewList)
    ? reviewModule.reviewList
    : []
  const reviewItems: ImportedReview[] = reviewItemsRaw.map((raw) => {
    const r = asRec(raw)
    const rating = Math.max(1, Math.min(5, Math.round(num(r.star) || 5)))
    return {
      rating,
      author: txt(r.buyerName) || "Anonymous",
      country: txt(r.buyerCountry),
      date: parseDate(txt(r.reviewDate)),
      text: txt(r.reviewContent) || txt(r.buyerFeedback),
      images: (Array.isArray(r.images) ? r.images : [])
        .filter((i): i is string => typeof i === "string")
        .map((i) => hdImage(i)),
      variant: txt(r.skuInfo),
      helpful_count: Math.max(0, Math.round(num(r.thumbUpNum))),
      verified: true,
      sentiment: sentimentFromRating(rating),
    }
  })

  out.reviews = {
    total: Math.max(0, Math.round(num(reviewModule.totalValidNum))),
    average_rating: avg,
    breakdown: {
      5: Math.max(0, Math.round(num(starLevel.fiveStarNum))),
      4: Math.max(0, Math.round(num(starLevel.fourStarNum))),
      3: Math.max(0, Math.round(num(starLevel.threeStarNum))),
      2: Math.max(0, Math.round(num(starLevel.twoStarNum))),
      1: Math.max(0, Math.round(num(starLevel.oneStarNum))),
    },
    items: reviewItems.slice(0, 50),
    sentiment: globalSentiment(avg),
  }

  out.tags = generateSEOKeywords(out.title, reviewItems).slice(0, 6)
  return out
}

async function scrapeAmazon(url: string): Promise<ImportedProduct> {
  const html = await fetchDirect(url)
  const $ = cheerio.load(html)
  const out = baselineProduct(url, "amazon")
  out.title = $("#productTitle").text().trim()
  out.description = $("#feature-bullets").text().trim()
  out.price = num(
    $(".a-price .a-offscreen").first().text().replace(/[^\d.,]/g, "")
  )
  out.original_price = num(
    $(".a-text-price .a-offscreen").first().text().replace(/[^\d.,]/g, "")
  )
  out.images = [$("#landingImage").attr("src") ?? ""].filter(Boolean)
  out.brand = $("#bylineInfo").text().trim()
  out.currency = "USD"
  out.shipping = {
    from_country: "USA",
    delivery_time: "2-5 days",
    shipping_cost: 0,
    carrier: "",
  }
  out.reviews.total = parseInt(
    $("#acrCustomerReviewText").text().replace(/[^\d]/g, ""),
    10
  ) || 0
  out.reviews.average_rating = num(
    $(".a-icon-alt").first().text().split(" ")[0] || 0
  )
  out.reviews.sentiment = globalSentiment(out.reviews.average_rating)
  return out
}

async function scrapeShopify(url: string): Promise<ImportedProduct> {
  const jsonUrl = `${url.replace(/\/$/, "")}.json`
  const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(25000) })
  if (!res.ok) throw new Error(`Shopify JSON failed: ${res.status}`)
  const data = (await res.json()) as Record<string, unknown>
  const p = asRec(data.product)
  const out = baselineProduct(url, "shopify")
  out.title = txt(p.title)
  out.description = txt(p.body_html).replace(/<[^>]*>/g, "")
  out.images = (Array.isArray(p.images) ? p.images : [])
    .map((i) => txt(asRec(i).src))
    .filter(Boolean)
  const variants = Array.isArray(p.variants) ? p.variants : []
  out.variants = variants.map((vRaw) => {
    const v = asRec(vRaw)
    return {
      name: txt(v.title),
      type: "Variant",
      image: "",
      price: num(v.price),
      stock: Math.max(0, Math.round(num(v.inventory_quantity))),
      sku: txt(v.sku),
      attributes: {},
    }
  })
  out.price = out.variants[0]?.price || 0
  out.original_price = num(asRec(variants[0]).compare_at_price) || out.price
  out.sku = txt(asRec(variants[0]).sku)
  out.stock = Math.max(0, Math.round(num(asRec(variants[0]).inventory_quantity)))
  out.brand = txt(p.vendor)
  out.category = txt(p.product_type)
  out.currency = "USD"
  out.shipping = {
    from_country: "Unknown",
    delivery_time: "3-7 days",
    shipping_cost: 0,
    carrier: "",
  }
  return out
}

async function scrapeUniversal(url: string): Promise<ImportedProduct> {
  const html = await fetchDirect(url)
  const $ = cheerio.load(html)
  const out = baselineProduct(url, "universal")

  let ldProduct: Record<string, unknown> | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || "{}") as unknown
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const cRaw of candidates) {
        const c = asRec(cRaw)
        const t = c["@type"]
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
          ldProduct = c
          break
        }
      }
    } catch {
      /* ignore malformed jsonld */
    }
  })

  const p = asRec(ldProduct)
  const offers = asRec(p.offers)
  out.title =
    txt(p.name) || $('meta[property="og:title"]').attr("content") || ""
  out.description =
    txt(p.description) ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  out.price = num(offers.price || offers.lowPrice)
  out.original_price = num(offers.highPrice || offers.price) || out.price
  out.currency = txt(offers.priceCurrency) || "USD"
  const images = p.image
  if (typeof images === "string") out.images = [images]
  else if (Array.isArray(images))
    out.images = images.filter((i): i is string => typeof i === "string")
  out.brand = txt(asRec(p.brand).name)
  out.sku = txt(p.sku)
  out.stock = txt(offers.availability).includes("InStock") ? 999 : 0
  return out
}

function calculateQualityScore(p: ImportedProduct): number {
  let score = 0
  if (p.images.length >= 5) score += 20
  else if (p.images.length >= 3) score += 12
  if (p.reviews.total >= 500) score += 20
  else if (p.reviews.total >= 100) score += 12
  if (p.reviews.average_rating >= 4.5) score += 20
  else if (p.reviews.average_rating >= 4) score += 12
  if (p.variants.length >= 5) score += 15
  else if (p.variants.length >= 2) score += 8
  const days = parseInt(p.shipping.delivery_time.match(/\d+/)?.[0] ?? "14", 10)
  if (days <= 7) score += 15
  else if (days <= 14) score += 8
  if (p.description.length >= 400) score += 10
  else if (p.description.length >= 150) score += 6
  return Math.min(100, score)
}

async function checkDuplicate(product: ImportedProduct): Promise<boolean> {
  const sku = product.sku.trim()
  const title = product.title.trim()
  const whereByTitle =
    title.length > 0
      ? {
          name: { contains: title.slice(0, 40), mode: "insensitive" as const },
        }
      : undefined

  const existing = await prisma.product.findFirst({
    where: {
      OR: [
        ...(whereByTitle ? [whereByTitle] : []),
        ...(sku
          ? [
              {
                tags: {
                  has: sku,
                },
              },
            ]
          : []),
      ],
    },
    select: { id: true },
  })
  return Boolean(existing)
}

function generateSEOKeywords(title: string, reviews: ImportedReview[]): string[] {
  const reviewWords = reviews
    .slice(0, 20)
    .flatMap((r) => r.text.toLowerCase().split(/\W+/))
    .filter((w) => w.length >= 4)
  const titleWords = title.toLowerCase().split(/\W+/).filter((w) => w.length >= 3)
  const bag = [...titleWords, ...reviewWords]
  const freq = new Map<string, number>()
  for (const w of bag) freq.set(w, (freq.get(w) ?? 0) + 1)
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 12)
}

async function rewriteTitle(title: string): Promise<string> {
  return title
    .replace(/AliExpress|Amazon|Hot Sale|New Arrival|2026/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90)
}

async function rewriteDescription(description: string): Promise<string> {
  const clean = description
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return clean.slice(0, 3000)
}
