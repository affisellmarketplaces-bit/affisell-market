import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

import { auth } from "@/auth"
import { groqChatText } from "@/lib/ai/groq-client"
import { prisma } from "@/lib/prisma"

type ReviewSentiment = "positive" | "neutral" | "negative"
type Platform =
  | "aliexpress"
  | "amazon"
  | "shopify"
  | "shein"
  | "temu"
  | "universal"

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
  videos: string[]
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

function collectVideoUrls(...sources: unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const s = raw.trim()
    if (!s) return
    const withProto = /^https?:/i.test(s) ? s : s.startsWith("//") ? `https:${s}` : ""
    if (!withProto || !/^https?:\/\//i.test(withProto)) return
    if (seen.has(withProto)) return
    if (!/\.(mp4|webm|m3u8)(\?|#|$)/i.test(withProto) && !/video|\.mp4/i.test(withProto)) return
    seen.add(withProto)
    out.push(withProto)
  }
  for (const src of sources) {
    if (typeof src === "string") push(src)
    else if (Array.isArray(src)) {
      for (const item of src) {
        if (typeof item === "string") push(item)
        else if (item && typeof item === "object") {
          const r = asRec(item)
          push(txt(r.contentUrl))
          push(txt(r.url))
          push(txt(r.src))
        }
      }
    }
  }
  return out.slice(0, 3)
}

function extractVideosFromHtml($: cheerio.CheerioAPI): string[] {
  const urls: string[] = []
  $('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]').each(
    (_, el) => {
      urls.push($(el).attr("content") ?? "")
    }
  )
  $("video source[src], video[src]").each((_, el) => {
    urls.push($(el).attr("src") ?? "")
  })
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() || ""
    if (!/video/i.test(text)) return
    try {
      const parsed = JSON.parse(text) as unknown
      const walk = (node: unknown) => {
        if (!node || typeof node !== "object") return
        if (Array.isArray(node)) {
          node.forEach(walk)
          return
        }
        const r = asRec(node)
        if (txt(r.contentUrl)) urls.push(txt(r.contentUrl))
        if (txt(r.embedUrl)) urls.push(txt(r.embedUrl))
        for (const v of Object.values(r)) walk(v)
      }
      walk(parsed)
    } catch {
      /* ignore */
    }
  })
  return collectVideoUrls(urls)
}

function hdImage(raw: string): string {
  const s = raw.trim()
  if (!s) return ""
  const withProto = /^https?:/i.test(s) ? s : `https:${s}`
  return withProto.replace(/_\d+x\d+\./, "_960x960.")
}

function detectPlatform(url: string): Platform {
  const host = url.toLowerCase()
  if (host.includes("aliexpress.com")) return "aliexpress"
  if (host.includes("amazon.")) return "amazon"
  if (host.includes("/products/") || host.includes("myshopify.com")) return "shopify"
  if (host.includes("shein.com")) return "shein"
  if (host.includes("temu.com")) return "temu"
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

function baselineProduct(url: string, platform: Platform): ImportedProduct {
  return {
    title: "",
    description: "",
    ai_title: "",
    ai_description: "",
    price: 0,
    original_price: 0,
    currency: "USD",
    images: [],
    videos: [],
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
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      url?: string
      options?: { markup?: number; aiRewrite?: boolean }
    }
    const url = txt(body.url)
    if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 })

    const platform = detectPlatform(url)
    let product: ImportedProduct | null = null
    let method = "direct"

    try {
      product =
        platform === "shopify"
          ? await scrapeShopify(url)
          : await scrapeWithDirectFetch(url, platform)
    } catch (error) {
      console.warn("Tier 1 failed:", error)
    }

    if (!product?.title && process.env.SCRAPINGBEE_API_KEY) {
      method = "scrapingbee"
      product = await scrapeWithScrapingBee(url, platform)
    }

    if (!product?.title) {
      throw new Error(
        "Import failed. For AliExpress: Add SCRAPINGBEE_API_KEY to .env.local. Get free key at scrapingbee.com"
      )
    }

    if (platform === "aliexpress" || url.toLowerCase().includes("mango")) {
      product.title = await translateTitleToEnglish(product.title)
    }

    product.quality_score = calculateQualityScore(product)
    product.seo_keywords = generateSEO(product.title, product.category)
    product.is_duplicate = await checkDuplicate(product.title, product.images[0] ?? "")

    const markup =
      typeof body.options?.markup === "number" && body.options.markup > 0
        ? body.options.markup
        : 2.5
    product.suggested_price = parseFloat((product.price * markup).toFixed(2))
    product.profit_per_sale = parseFloat(
      (product.suggested_price - product.price).toFixed(2)
    )
    product.roi =
      product.price > 0
        ? Math.round((product.profit_per_sale / product.price) * 100)
        : 0
    product.basePrice = product.suggested_price
    product.costPrice = product.price

    if (body.options?.aiRewrite && process.env.GROQ_API_KEY?.trim()) {
      product.description = await rewriteWithAI(product.description)
      product.ai_description = product.description
    }

    return NextResponse.json({
      products: [product],
      success: true,
      platform,
      method,
      innovations: {
        quality_score: product.quality_score,
        duplicate: product.is_duplicate,
        profit: `$${product.profit_per_sale.toFixed(2)}/sale`,
        roi: `${product.roi}%`,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed",
        success: false,
      },
      { status: 422 }
    )
  }
}

async function scrapeWithScrapingBee(
  url: string,
  platform: Platform
): Promise<ImportedProduct> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY is missing")
  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    render_js: "true",
    premium_proxy: "true",
    country_code: "us",
  })
  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error("ScrapingBee failed")
  const html = await res.text()
  return parseProductHTML(html, url, platform)
}

async function scrapeWithDirectFetch(
  url: string,
  platform: Platform
): Promise<ImportedProduct> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Blocked: ${res.status}`)
  const html = await res.text()
  return parseProductHTML(html, url, platform)
}

function parseProductHTML(
  html: string,
  url: string,
  platform: Platform
): ImportedProduct {
  const $ = cheerio.load(html)

  if (platform === "aliexpress") {
    let aerData: Record<string, unknown> | null = null
    $("script").each((_, el) => {
      const content = $(el).html() || ""
      if (!content.includes("__AER_DATA__")) return
      const m = content.match(/window\.__AER_DATA__\s*=\s*({[\s\S]*?});/m)
      if (!m?.[1]) return
      try {
        aerData = JSON.parse(m[1]) as Record<string, unknown>
      } catch {
        /* noop */
      }
    })
    if (!aerData) throw new Error("__AER_DATA__ not found")
    const out = parseAERData(aerData, url)
    out.videos = collectVideoUrls(out.videos, extractVideosFromHtml($))
    return out
  }

  if (platform === "amazon") {
    const out = parseAmazonHTML(html, url)
    out.videos = collectVideoUrls(out.videos, extractVideosFromHtml($))
    return out
  }

  if (platform === "shein" || platform === "temu" || platform === "universal") {
    const fromSchema = parseSchemaProduct($, url, platform)
    if (fromSchema.title) {
      fromSchema.videos = collectVideoUrls(fromSchema.videos, extractVideosFromHtml($))
      return fromSchema
    }
  }

  throw new Error("Platform not supported yet")
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
  out.images = (Array.isArray(productInfo.imagePathList)
    ? productInfo.imagePathList
    : []
  )
    .filter((i): i is string => typeof i === "string")
    .map((i) => hdImage(i))
    .slice(0, 12)
  out.brand = txt(productInfo.storeName)
  out.sku = `AE-${url.match(/item\/(\d+)\.html/)?.[1] ?? ""}`
  out.stock = num(productInfo.totalAvailQuantity) || 999
  out.shipping = {
    from_country: txt(freightInfo.shipFrom) || "China",
    delivery_time: txt(freightInfo.deliveryTimeDesc) || "15-25 days",
    shipping_cost: 0,
    carrier: "Standard",
  }

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
  out.variants = variants
  out.colors = variants
    .filter((v) => v.type.toLowerCase().includes("color"))
    .map((v) => ({ name: v.name, image: v.image, hex: "#CCCCCC" }))
  out.sizes = variants
    .filter((v) => v.type.toLowerCase().includes("size"))
    .map((v) => ({ name: v.name, value: v.name }))

  const starLevel = asRec(reviewModule.starLevel)
  const avg = num(reviewModule.averageStar)
  const reviewItemsRaw = Array.isArray(reviewModule.reviewList)
    ? reviewModule.reviewList
    : []
  const reviewItems: ImportedReview[] = reviewItemsRaw.slice(0, 50).map((raw) => {
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
    items: reviewItems,
    sentiment: globalSentiment(avg),
  }

  const mediaModule = asRec(p.mediaComponent)
  const videoPath = txt(asRec(mediaModule).videoPath) || txt(productInfo.videoPath)
  if (videoPath) out.videos = collectVideoUrls([hdImage(videoPath)])

  out.category = "AliExpress Product"
  out.tags = generateSEO(out.title, out.category)
  return out
}

function parseAmazonHTML(html: string, url: string): ImportedProduct {
  const $ = cheerio.load(html)
  const out = baselineProduct(url, "amazon")
  out.title = $("#productTitle").text().trim()
  out.description = $("#feature-bullets").text().trim()
  out.price = num($(".a-price .a-offscreen").first().text().replace(/[^\d.,]/g, ""))
  out.original_price = num(
    $(".a-text-price .a-offscreen").first().text().replace(/[^\d.,]/g, "")
  )
  $("#altImages img, #imageBlock img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? ""
    if (src) out.images.push(hdImage(src))
  })
  const landing = $("#landingImage").attr("src") ?? ""
  if (landing) out.images.unshift(hdImage(landing))
  out.images = [...new Set(out.images.filter(Boolean))].slice(0, 12)
  if (out.images.length === 0 && landing) out.images = [hdImage(landing)]
  out.brand = $("#bylineInfo").text().trim()
  out.shipping = {
    from_country: "USA",
    delivery_time: "2-5 days",
    shipping_cost: 0,
    carrier: "",
  }
  out.reviews.total =
    parseInt($("#acrCustomerReviewText").text().replace(/[^\d]/g, ""), 10) || 0
  out.reviews.average_rating = num($(".a-icon-alt").first().text().split(" ")[0])
  out.reviews.sentiment = globalSentiment(out.reviews.average_rating)
  out.category = "Amazon Product"
  out.tags = generateSEO(out.title, out.category)
  return out
}

function parseSchemaProduct(
  $: cheerio.CheerioAPI,
  url: string,
  platform: Platform
): ImportedProduct {
  const out = baselineProduct(url, platform)
  let ldProduct: Record<string, unknown> | null = null

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() || ""
    if (!text.trim()) return
    try {
      const parsed = JSON.parse(text) as unknown
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const candidateRaw of candidates) {
        const candidate = asRec(candidateRaw)
        const type = candidate["@type"]
        if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
          ldProduct = candidate
          break
        }
      }
    } catch {
      /* ignore malformed jsonld */
    }
  })

  const p = asRec(ldProduct)
  const offers = asRec(p.offers)
  out.title = txt(p.name) || txt($('meta[property="og:title"]').attr("content"))
  out.description =
    txt(p.description) || txt($('meta[property="og:description"]').attr("content"))
  out.price = num(offers.price || offers.lowPrice)
  out.original_price = num(offers.highPrice || offers.price) || out.price
  out.currency = txt(offers.priceCurrency) || "USD"

  const images = p.image
  if (typeof images === "string") out.images = [images]
  else if (Array.isArray(images)) {
    out.images = images.filter((i): i is string => typeof i === "string")
  }

  out.brand = txt(asRec(p.brand).name)
  out.sku = txt(p.sku)
  out.stock = txt(offers.availability).includes("InStock") ? 999 : 0
  out.category = txt(p.category) || "General"
  const video = p.video
  out.videos = collectVideoUrls(
    typeof video === "string" ? [video] : Array.isArray(video) ? video : []
  )
  out.tags = generateSEO(out.title, out.category)
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
  out.category = txt(p.product_type) || "Shopify Product"
  const media = Array.isArray(p.media) ? p.media : []
  const videoUrls = media
    .map((m) => asRec(m))
    .filter((m) => txt(m.media_type) === "video" || /\.mp4/i.test(txt(m.src)))
    .map((m) => {
      const sources = Array.isArray(m.sources) ? m.sources : []
      const first = sources[0] ? asRec(sources[0]) : null
      return txt(first?.url) || txt(m.src)
    })
    .filter(Boolean)
  out.videos = collectVideoUrls(videoUrls)
  out.tags = generateSEO(out.title, out.category)
  return out
}

function calculateQualityScore(p: ImportedProduct): number {
  let score = 0
  if (p.images.length >= 5) score += 25
  if (p.reviews.total > 100) score += 25
  if (p.reviews.average_rating >= 4) score += 25
  if (p.variants.length > 0) score += 25
  return score
}

function generateSEO(title: string, category: string): string[] {
  const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  return [...new Set([...words, category.toLowerCase(), "buy online", "best price"])].slice(
    0,
    10
  )
}

async function checkDuplicate(title: string, image: string): Promise<boolean> {
  const normalizedTitle = title.trim()
  const normalizedImage = image.trim()
  const candidate = await prisma.product.findFirst({
    where: {
      OR: [
        ...(normalizedTitle
          ? [
              {
                name: {
                  contains: normalizedTitle.slice(0, 40),
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
        ...(normalizedImage ? [{ tags: { has: normalizedImage.slice(0, 120) } }] : []),
      ],
    },
    select: { id: true },
  })
  return Boolean(candidate)
}

async function rewriteWithAI(text: string): Promise<string> {
  if (!process.env.GROQ_API_KEY?.trim() || !text.trim()) return text
  const prompt = `Rewrite the following product description to be clearer, concise, SEO-friendly, and conversion-oriented. Keep factual claims only.\n\n${text.slice(
    0,
    3500
  )}`

  try {
    return (
      (await groqChatText({
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You are an ecommerce copywriter. Return plain text only, no markdown.",
          },
          { role: "user", content: prompt },
        ],
      })) || text
    )
  } catch {
    return text
  }
}

async function translateTitleToEnglish(scrapedTitle: string): Promise<string> {
  if (!process.env.GROQ_API_KEY?.trim() || !scrapedTitle.trim()) return scrapedTitle
  try {
    return (
      (await groqChatText({
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: `Translate to English commercial product title, max 60 chars, remove country names: "${scrapedTitle}"`,
          },
        ],
      })) || scrapedTitle
    )
  } catch {
    return scrapedTitle
  }
}
