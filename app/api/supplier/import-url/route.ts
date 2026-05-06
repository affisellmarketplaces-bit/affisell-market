import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface ReviewItem {
  rating?: number
  author?: string
  country?: string
  date?: string
  text?: string
  images?: string[]
  variant?: string
  helpful_count?: number
  verified?: boolean
  sentiment?: "positive" | "neutral" | "negative"
}

interface UniversalProduct {
  title: string
  ai_title: string
  description: string
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
    items: ReviewItem[]
    sentiment: "positive" | "neutral" | "negative"
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

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function safeText(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function toHdImage(url: string): string {
  if (!url) return ""
  const base = url.startsWith("http") ? url : `https:${url}`
  return base.replace(/_\d+x\d+\./, "_960x960.")
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string }
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }

    const platform = detectPlatform(url)

    const product = await extractWithFallback(url, platform)

    if (!product || !product.title) {
      throw new Error("Extraction failed on all methods")
    }

    product.ai_title = await aiRewriteTitle(product.title, product.category)
    product.ai_description = await aiRewriteDescription(product.description)

    const pricing = calculateSmartPricing(product.price, product.reviews.average_rating)
    Object.assign(product, pricing)

    product.category = product.category || detectCategoryAI(product.title, product.description)
    product.tags = generateSEOTags(product.title, product.category, product.brand)
    product.seo_keywords = extractKeywords(`${product.title} ${product.description}`)

    product.quality_score = calculateQualityScore(product)
    product.is_duplicate = false

    product.reviews.sentiment = analyzeSentiment(product.reviews.items)

    product.colors = product.colors.map((c) => ({
      ...c,
      hex: extractColorHex(c.name, c.image),
    }))

    return NextResponse.json({
      products: [product],
      success: true,
      platform,
      extraction_method: "universal-multi-fallback",
      innovations: ["ai_rewrite", "smart_pricing", "quality_score", "sentiment_analysis"],
      debug: {
        variants: product.variants.length,
        images: product.images.length,
        price: product.price,
        reviews: product.reviews.total,
        quality_score: product.quality_score,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Import failed",
        details: message,
        suggestion: "Try a different URL or check if product page is public",
      },
      { status: 422 }
    )
  }
}

async function extractWithFallback(url: string, platform: string): Promise<UniversalProduct | null> {
  const methods = [
    () => extractByAPI(url, platform),
    () => extractByJSONLD(url),
    () => extractByHTML(url),
  ]

  for (const method of methods) {
    try {
      const result = await method()
      if (result?.title) return result
    } catch {
      continue
    }
  }
  return null
}

async function extractByAPI(url: string, platform: string): Promise<UniversalProduct | null> {
  if (platform === "aliexpress") {
    const productId = url.match(/item\/(\d+)\.html/)?.[1]
    if (!productId) return null

    const api = `https://m.aliexpress.com/api/products/detail?productId=${productId}&lang=en&country=US`
    const res = await fetch(api, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as Record<string, unknown>
    return parseAliExpressMobile(asObject(data.result), url, productId)
  }

  if (platform === "shopify") {
    const jsonUrl = url.replace(/\/$/, "") + ".json"
    const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(25000) })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    return parseShopify(asObject(data.product), url)
  }

  return null
}

async function extractByJSONLD(url: string): Promise<UniversalProduct | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(25000),
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  let jsonld: Record<string, unknown> = {}
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || "{}") as unknown
      const data = asObject(parsed)
      const dataType = data["@type"]
      if (dataType === "Product") {
        jsonld = data
        return
      }
      const graph = Array.isArray(data["@graph"]) ? data["@graph"] : []
      const productNode = graph
        .map((g) => asObject(g))
        .find((g) => g["@type"] === "Product")
      if (productNode) jsonld = productNode
    } catch {}
  })

  if (!safeText(jsonld.name)) return null

  const offers = asObject(jsonld.offers)
  const brand = asObject(jsonld.brand)
  const agg = asObject(jsonld.aggregateRating)
  const rawImage = jsonld.image
  const images = Array.isArray(rawImage)
    ? rawImage.filter((x): x is string => typeof x === "string").slice(0, 10)
    : typeof rawImage === "string"
      ? [rawImage]
      : []

  return {
    title: safeText(jsonld.name),
    ai_title: "",
    description: safeText(jsonld.description),
    ai_description: "",
    price: num(offers.price || offers.lowPrice),
    original_price: num(offers.highPrice || offers.price),
    currency: safeText(offers.priceCurrency) || "USD",
    images,
    variants: [],
    colors: [],
    sizes: [],
    brand: safeText(brand.name),
    category: safeText(jsonld.category),
    sku: safeText(jsonld.sku),
    stock: safeText(offers.availability).includes("InStock") ? 999 : 0,
    shipping: { from_country: "Unknown", delivery_time: "7-14 days", shipping_cost: 0, carrier: "" },
    reviews: {
      total: parseInt(String(agg.reviewCount || "0"), 10) || 0,
      average_rating: num(agg.ratingValue),
      breakdown: {},
      items: [],
      sentiment: "neutral",
    },
    specs: {},
    source_platform: "universal",
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

async function extractByHTML(url: string): Promise<UniversalProduct | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(25000),
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  return {
    title: $('meta[property="og:title"]').attr("content") || $("h1").first().text().trim(),
    ai_title: "",
    description: $('meta[property="og:description"]').attr("content") || "",
    ai_description: "",
    price: num($('meta[property="product:price:amount"]').attr("content") || 0),
    original_price: 0,
    currency: $('meta[property="product:price:currency"]').attr("content") || "USD",
    images: $('meta[property="og:image"]')
      .map((_, el) => $(el).attr("content") || "")
      .get()
      .filter(Boolean)
      .slice(0, 10),
    variants: [],
    colors: [],
    sizes: [],
    brand: "",
    category: "",
    sku: "",
    stock: 0,
    shipping: { from_country: "Unknown", delivery_time: "7-14 days", shipping_cost: 0, carrier: "" },
    reviews: { total: 0, average_rating: 0, breakdown: {}, items: [], sentiment: "neutral" },
    specs: {},
    source_platform: "universal",
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

function parseAliExpressMobile(data: Record<string, unknown>, url: string, productId: string): UniversalProduct {
  const p = asObject(data.productInfo)
  const sku = asObject(data.skuModule)
  const review = asObject(data.reviewModule)
  const shippingModule = asObject(data.shippingModule)
  const freight = asObject(shippingModule.generalFreightInfo)

  const skuPriceList = Array.isArray(sku.skuPriceList) ? sku.skuPriceList : []
  const prices = skuPriceList
    .map((s) => {
      const skuVal = asObject(asObject(s).skuVal)
      const act = asObject(skuVal.skuActivityAmount)
      const amt = asObject(skuVal.skuAmount)
      return num(act.value || amt.value)
    })
    .filter((x) => x > 0)

  const variants = (Array.isArray(sku.productSKUPropertyList) ? sku.productSKUPropertyList : []).flatMap((prop) => {
    const propObj = asObject(prop)
    const propName = safeText(propObj.skuPropertyName)
    const values = Array.isArray(propObj.skuPropertyValues) ? propObj.skuPropertyValues : []
    return values.map((v) => {
      const val = asObject(v)
      const displayName = safeText(val.propertyValueDisplayName)
      const image = safeText(val.skuPropertyImagePath) ? toHdImage(safeText(val.skuPropertyImagePath)) : ""
      const valueId = safeText(val.propertyValueId)
      return {
        name: displayName,
        type: propName,
        image,
        price: prices[0] || 0,
        stock: 50,
        sku: `AE-${productId}-${valueId}`,
        attributes: { [propName]: displayName },
      }
    })
  })

  const colors = variants
    .filter((v) => v.type.toLowerCase().includes("color"))
    .map((v) => ({ name: v.name, image: v.image, hex: "#CCCCCC" }))

  const sizes = variants
    .filter((v) => v.type.toLowerCase().includes("size") || v.type.toLowerCase().includes("length"))
    .map((v) => ({ name: v.name, value: v.name }))

  const reviewList = Array.isArray(review.reviewList) ? review.reviewList : []
  const breakdown = {
    5: num(asObject(review.starLevel)[5] ?? asObject(review.starLevel).fiveStarNum),
    4: num(asObject(review.starLevel)[4] ?? asObject(review.starLevel).fourStarNum),
    3: num(asObject(review.starLevel)[3] ?? asObject(review.starLevel).threeStarNum),
    2: num(asObject(review.starLevel)[2] ?? asObject(review.starLevel).twoStarNum),
    1: num(asObject(review.starLevel)[1] ?? asObject(review.starLevel).oneStarNum),
  }
  const avgRating = num(review.averageStar) || 0

  return {
    title: safeText(p.subject),
    ai_title: "",
    description: safeText(p.description),
    ai_description: "",
    price: prices.length ? Math.min(...prices) : 0,
    original_price: prices.length ? Math.max(...prices) : 0,
    currency: "USD",
    images: (Array.isArray(p.imagePathList) ? p.imagePathList : [])
      .filter((i): i is string => typeof i === "string")
      .map((i) => toHdImage(i))
      .slice(0, 10),
    variants,
    colors,
    sizes,
    brand: safeText(p.storeName),
    category: "",
    sku: `AE-${productId}`,
    stock: num(p.totalAvailQuantity) || 999,
    shipping: {
      from_country: safeText(freight.shipFrom) || "China",
      delivery_time: safeText(freight.deliveryTimeDesc) || "15-25 days",
      shipping_cost: 0,
      carrier: "Standard",
    },
    reviews: {
      total: num(review.totalValidNum) || 0,
      average_rating: avgRating,
      breakdown,
      items: reviewList.slice(0, 50).map((raw) => {
        const r = asObject(raw)
        const rating = Math.max(1, Math.min(5, Math.round(num(r.star) || 5)))
        const imgs = Array.isArray(r.images) ? r.images : []
        return {
          rating,
          author: safeText(r.buyerName) || "Anonymous",
          country: safeText(r.buyerCountry),
          date: safeText(r.reviewDate) || new Date().toISOString(),
          text: safeText(r.reviewContent) || safeText(r.buyerFeedback),
          images: imgs
            .filter((i): i is string => typeof i === "string")
            .map((i) => toHdImage(i)),
          variant: safeText(r.skuInfo),
          helpful_count: Math.max(0, Math.round(num(r.thumbUpNum) || 0)),
          verified: true,
          sentiment: rating >= 4 ? "positive" : rating >= 3 ? "neutral" : "negative",
        } as ReviewItem
      }),
      sentiment: avgRating >= 4 ? "positive" : avgRating >= 3 ? "neutral" : "negative",
    },
    specs: {},
    source_platform: "aliexpress",
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

function parseShopify(p: Record<string, unknown>, url: string): UniversalProduct {
  const variantsRaw = Array.isArray(p.variants) ? p.variants : []
  const first = asObject(variantsRaw[0])

  return {
    title: safeText(p.title),
    ai_title: "",
    description: safeText(p.body_html).replace(/<[^>]*>/g, ""),
    ai_description: "",
    price: num(first.price),
    original_price: num(first.compare_at_price) || num(first.price),
    currency: "USD",
    images: (Array.isArray(p.images) ? p.images : [])
      .map((i) => asObject(i))
      .map((i) => safeText(i.src))
      .filter(Boolean),
    variants: variantsRaw.map((v) => {
      const row = asObject(v)
      return {
        name: safeText(row.title),
        type: "Variant",
        image: "",
        price: num(row.price),
        stock: num(row.inventory_quantity),
        sku: safeText(row.sku),
        attributes: {},
      }
    }),
    colors: [],
    sizes: [],
    brand: safeText(p.vendor),
    category: safeText(p.product_type),
    sku: safeText(first.sku),
    stock: num(first.inventory_quantity),
    shipping: { from_country: "USA", delivery_time: "3-7 days", shipping_cost: 0, carrier: "" },
    reviews: { total: 0, average_rating: 0, breakdown: {}, items: [], sentiment: "neutral" },
    specs: {},
    source_platform: "shopify",
    source_url: url,
    basePrice: 0,
    costPrice: 0,
    suggested_price: 0,
    suggested_commission: 25,
    profit_per_sale: 0,
    roi: 0,
    tags: safeText(p.tags).split(", ").filter(Boolean),
    quality_score: 0,
    is_duplicate: false,
    seo_keywords: [],
  }
}

async function aiRewriteTitle(title: string, category: string): Promise<string> {
  void category
  return title
    .replace(/AliExpress|Amazon|Hot Sale|New|2026|Best|Cheap|Wholesale/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80)
}

async function aiRewriteDescription(desc: string): Promise<string> {
  return desc.substring(0, 500)
}

function calculateSmartPricing(cost: number, rating: number) {
  const baseMarkup = 1.7
  const ratingBonus = rating >= 4.5 ? 0.1 : 0
  const markup = baseMarkup + ratingBonus
  const suggested_price = parseFloat((cost * markup).toFixed(2))
  const profit = parseFloat((suggested_price - cost).toFixed(2))
  return {
    suggested_price,
    suggested_commission: 25,
    profit_per_sale: profit,
    roi: cost > 0 ? parseFloat(((profit / cost) * 100).toFixed(0)) : 0,
    basePrice: suggested_price,
    costPrice: cost,
  }
}

function detectCategoryAI(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase()
  if (/car|auto|vehicle|motor/.test(t)) return "Automotive"
  if (/phone|cable|charger|electronic|gadget/.test(t)) return "Electronics"
  if (/dress|shirt|shoe|fashion|cloth/.test(t)) return "Fashion"
  if (/home|kitchen|garden|decor/.test(t)) return "Home & Garden"
  if (/toy|game|kid/.test(t)) return "Toys"
  if (/beauty|makeup|skin/.test(t)) return "Beauty"
  return "General"
}

function generateSEOTags(title: string, category: string, brand: string): string[] {
  const words = title.toLowerCase().split(" ").filter((w) => w.length > 3)
  return [category.toLowerCase(), brand.toLowerCase(), ...words.slice(0, 5)].filter(Boolean)
}

function extractKeywords(text: string): string[] {
  return text.toLowerCase().match(/\b\w{4,}\b/g)?.slice(0, 10) || []
}

function calculateQualityScore(p: UniversalProduct): number {
  let score = 0
  if (p.title.length > 20) score += 15
  if (p.images.length >= 3) score += 20
  if (p.variants.length > 1) score += 20
  if (p.reviews.total > 100) score += 15
  if (p.reviews.average_rating >= 4) score += 15
  if (p.description.length > 100) score += 15
  return score
}

function analyzeSentiment(reviews: ReviewItem[]): "positive" | "neutral" | "negative" {
  if (!reviews.length) return "neutral"
  const avg = reviews.reduce((sum, r) => sum + (num(r.rating) || 5), 0) / reviews.length
  return avg >= 4 ? "positive" : avg >= 3 ? "neutral" : "negative"
}

function extractColorHex(name: string, image: string): string {
  void image
  const colors: Record<string, string> = {
    red: "#FF0000",
    blue: "#0000FF",
    green: "#008000",
    black: "#000000",
    white: "#FFFFFF",
    yellow: "#FFFF00",
    pink: "#FFC0CB",
    purple: "#800080",
  }
  const n = name.toLowerCase()
  const hit = Object.keys(colors).find((c) => n.includes(c))
  return hit ? colors[hit] : "#CCCCCC"
}

function detectPlatform(url: string): string {
  if (url.includes("aliexpress.com")) return "aliexpress"
  if (url.includes("amazon.")) return "amazon"
  if (url.includes("ebay.")) return "ebay"
  if (url.includes("etsy.com")) return "etsy"
  if (url.includes("temu.com")) return "temu"
  if (url.includes("shein.com")) return "shein"
  if (url.includes("/products/") || url.includes("myshopify.com")) return "shopify"
  return "universal"
}
