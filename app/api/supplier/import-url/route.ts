import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface UniversalProduct {
  title: string
  description: string
  price: number
  original_price: number
  currency: string
  images: string[]
  variants: Array<Record<string, unknown>>
  colors: Array<Record<string, unknown>>
  sizes: Array<Record<string, unknown> | string>
  brand: string
  category: string
  sku: string
  stock: number
  shipping: Record<string, unknown>
  reviews: Record<string, unknown>
  specs: Record<string, string>
  source_platform: string
  source_url: string
  basePrice: number
  costPrice: number
  suggested_price: number
  profit_per_sale: number
  roi: number
  tags: string[]
  ai_title: string
  is_duplicate?: boolean
  quality_score?: number
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = parseFloat(String(value ?? "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>
  return {}
}

function toHdImage(src: string): string {
  const s = src.trim()
  if (!s) return ""
  const withProtocol = s.startsWith("http") ? s : `https:${s}`
  return withProtocol.replace(/_\d+x\d+\./, "_960x960.")
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

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string }
    if (!url || typeof url !== "string")
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })

    const platform = detectPlatform(url)

    let product: UniversalProduct | null = null
    let extractionMethod = ""

    switch (platform) {
      case "aliexpress":
        product = await extractAliExpress(url)
        extractionMethod = "aliexpress-api"
        break
      case "amazon":
        product = await extractAmazon(url)
        extractionMethod = "amazon-parser"
        break
      case "shopify":
        product = await extractShopify(url)
        extractionMethod = "shopify-json"
        break
      case "ebay":
        product = await extractEbay(url)
        extractionMethod = "ebay-parser"
        break
      default:
        product = await extractUniversal(url)
        extractionMethod = "universal-jsonld"
    }

    if (!product || !product.title) {
      throw new Error("Could not extract product data from this URL")
    }

    product.ai_title = await aiRewriteTitle(product.title)
    product.category = product.category || detectCategory(product.title, product.description)
    product.tags = generateSEOTags(product.title, product.category)

    const markup = 1.7
    product.suggested_price = parseFloat((product.price * markup).toFixed(2))
    product.basePrice = product.suggested_price
    product.costPrice = product.price
    product.profit_per_sale = parseFloat((product.suggested_price - product.price).toFixed(2))
    product.roi = product.price > 0
      ? parseFloat(((product.profit_per_sale / product.price) * 100).toFixed(0))
      : 0

    product.is_duplicate = false
    product.quality_score = calculateQualityScore(product)

    return NextResponse.json({
      products: [product],
      success: true,
      extraction_method: extractionMethod,
      platform,
      debug: {
        variants: product.variants.length,
        images: product.images.length,
        price: product.price,
        reviews: product.reviews?.total || 0,
        quality_score: product.quality_score,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Import failed",
        details: message,
        suggestion: "Check if URL is a valid product page or try again",
      },
      { status: 422 }
    )
  }
}

async function extractAliExpress(url: string): Promise<UniversalProduct | null> {
  const productId = url.match(/item\/(\d+)\.html/)?.[1]
  if (!productId) return null

  const mobileApi = `https://m.aliexpress.com/api/products/detail?productId=${productId}&lang=en&country=US&currency=USD`
  const res = await fetch(mobileApi, {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
    signal: AbortSignal.timeout(25000),
  })

  if (!res.ok) return await extractUniversal(url)

  const data = (await res.json()) as Record<string, unknown>
  const result = asRecord(data.result)
  const p = asRecord(result.productInfo)
  const sku = asRecord(result.skuModule)
  const review = asRecord(result.reviewModule)
  const shippingModule = asRecord(result.shippingModule)
  const freight = asRecord(shippingModule.generalFreightInfo)

  const skuPriceList = Array.isArray(sku.skuPriceList) ? sku.skuPriceList : []
  const prices = skuPriceList
    .map((s) => {
      const row = asRecord(s)
      const val = asRecord(row.skuVal)
      const act = asRecord(val.skuActivityAmount)
      const amt = asRecord(val.skuAmount)
      return num(act.value) || num(amt.value)
    })
    .filter((x) => x > 0)

  const variants = (Array.isArray(sku.productSKUPropertyList) ? sku.productSKUPropertyList : []).flatMap((prop) => {
    const pRec = asRecord(prop)
    const propName = String(pRec.skuPropertyName ?? "").trim()
    const values = Array.isArray(pRec.skuPropertyValues) ? pRec.skuPropertyValues : []
    return values.map((v) => {
      const val = asRecord(v)
      const img = typeof val.skuPropertyImagePath === "string" ? toHdImage(val.skuPropertyImagePath) : ""
      return {
        name: String(val.propertyValueDisplayName ?? "").trim(),
        type: propName,
        image: img,
        price: prices[0] || 0,
        stock: 50,
      }
    })
  })

  const imagePathList = Array.isArray(p.imagePathList) ? p.imagePathList : []
  const images = imagePathList
    .filter((i): i is string => typeof i === "string")
    .map((i) => toHdImage(i))
    .filter(Boolean)
    .slice(0, 10)

  return {
    title: String(p.subject ?? ""),
    description: String(p.description ?? ""),
    price: prices.length ? Math.min(...prices) : 0,
    original_price: prices.length ? Math.max(...prices) : 0,
    currency: "USD",
    images,
    variants,
    colors: [],
    sizes: [],
    brand: String(p.storeName ?? ""),
    category: "",
    sku: `AE-${productId}`,
    stock: num(p.totalAvailQuantity) || 999,
    shipping: {
      from_country: String(freight.shipFrom ?? "China"),
      delivery_time: String(freight.deliveryTimeDesc ?? "15-25 days"),
    },
    reviews: {
      total: num(review.totalValidNum) || 0,
      average_rating: num(review.averageStar) || 0,
      items: (Array.isArray(review.reviewList) ? review.reviewList : []).slice(0, 20).map((r) => {
        const rv = asRecord(r)
        const imgs = Array.isArray(rv.images) ? rv.images : []
        return {
          rating: num(rv.star) || 5,
          author: String(rv.buyerName ?? "Anonymous"),
          text: String(rv.reviewContent ?? ""),
          images: imgs.filter((i): i is string => typeof i === "string").map((i) => toHdImage(i)),
          verified: true,
        }
      }),
    },
    specs: {},
    source_platform: "aliexpress",
    source_url: url,
    basePrice: 0,
    costPrice: 0,
    suggested_price: 0,
    profit_per_sale: 0,
    roi: 0,
    tags: [],
    ai_title: "",
  }
}

async function extractAmazon(url: string): Promise<UniversalProduct | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(25000),
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  let data: Record<string, unknown> = {}
  const rawJsonLd = $('script[type="application/ld+json"]').first().html()
  try {
    const parsed = JSON.parse(rawJsonLd || "{}")
    data = asRecord(Array.isArray(parsed) ? parsed[0] : parsed)
  } catch {}

  const offers = asRecord(data.offers)
  const priceText = $(".a-price-whole").first().text().replace(/[^\d.]/g, "")
  const oldPriceText = $(".a-text-price.a-offscreen").first().text().replace(/[^\d.]/g, "")

  const landingImage = $("#landingImage").attr("src") || ""

  return {
    title: $("#productTitle").text().trim() || String(data.name ?? ""),
    description: $("#feature-bullets").text().trim() || String(data.description ?? ""),
    price: num(priceText) || num(offers.price),
    original_price: num(oldPriceText),
    currency: "USD",
    images: landingImage ? [landingImage] : [],
    variants: [],
    colors: [],
    sizes: [],
    brand: $("#bylineInfo").text().trim() || "",
    category: $("#wayfinding-breadcrumbs_feature_div").text().trim() || "",
    sku: url.match(/\/dp\/([A-Z0-9]+)/)?.[1] || "",
    stock: 999,
    shipping: { from_country: "USA", delivery_time: "2-5 days" },
    reviews: {
      total: parseInt($("#acrCustomerReviewText").text().replace(/[^\d]/g, "") || "0", 10),
      average_rating: num($(".a-icon-alt").first().text().split(" ")[0] || "0"),
      items: [],
    },
    specs: {},
    source_platform: "amazon",
    source_url: url,
    basePrice: 0,
    costPrice: 0,
    suggested_price: 0,
    profit_per_sale: 0,
    roi: 0,
    tags: [],
    ai_title: "",
  }
}

async function extractShopify(url: string): Promise<UniversalProduct | null> {
  const jsonUrl = url.replace(/\/$/, "") + ".json"
  const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(25000) })
  if (!res.ok) return null

  const data = (await res.json()) as Record<string, unknown>
  const p = asRecord(data.product)
  if (!p.title) return null

  const variants = Array.isArray(p.variants) ? p.variants : []
  const images = Array.isArray(p.images) ? p.images : []
  const firstVariant = asRecord(variants[0])

  return {
    title: String(p.title),
    description: String(p.body_html ?? "").replace(/<[^>]*>/g, ""),
    price: num(firstVariant.price),
    original_price: num(firstVariant.compare_at_price) || num(firstVariant.price),
    currency: "USD",
    images: images.map((i) => asRecord(i)).map((i) => String(i.src ?? "")).filter(Boolean),
    variants: variants.map((v) => {
      const row = asRecord(v)
      return {
        name: String(row.title ?? ""),
        type: "Variant",
        price: num(row.price),
        stock: num(row.inventory_quantity),
        sku: String(row.sku ?? ""),
      }
    }),
    colors: [],
    sizes: [],
    brand: String(p.vendor ?? ""),
    category: String(p.product_type ?? ""),
    sku: String(firstVariant.sku ?? ""),
    stock: num(firstVariant.inventory_quantity),
    shipping: { from_country: "USA", delivery_time: "3-7 days" },
    reviews: { total: 0, average_rating: 0, items: [] },
    specs: {},
    source_platform: "shopify",
    source_url: url,
    basePrice: 0,
    costPrice: 0,
    suggested_price: 0,
    profit_per_sale: 0,
    roi: 0,
    tags: String(p.tags ?? "").split(", ").filter(Boolean),
    ai_title: "",
  }
}

async function extractEbay(url: string): Promise<UniversalProduct | null> {
  return extractUniversal(url)
}

async function extractUniversal(url: string): Promise<UniversalProduct | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(25000),
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  let jsonld: Record<string, unknown> = {}
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || "{}")
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const candidate of candidates) {
        const c = asRecord(candidate)
        const t = c["@type"]
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
          jsonld = c
          break
        }
      }
    } catch {}
  })

  const offers = asRecord(jsonld.offers)
  const brand = asRecord(jsonld.brand)

  const ogTitle = $('meta[property="og:title"]').attr("content") || ""
  const ogImage = $('meta[property="og:image"]').attr("content") || ""
  const ogDesc = $('meta[property="og:description"]').attr("content") || ""

  const jsonImage = jsonld.image
  const images = Array.isArray(jsonImage)
    ? jsonImage.filter((x): x is string => typeof x === "string")
    : typeof jsonImage === "string"
      ? [jsonImage]
      : ogImage
        ? [ogImage]
        : []

  const agg = asRecord(jsonld.aggregateRating)

  return {
    title: String(jsonld.name ?? ogTitle ?? $("title").text().trim()),
    description: String(jsonld.description ?? ogDesc ?? ""),
    price: num(offers.price) || num($('meta[property="product:price:amount"]').attr("content")),
    original_price: num(offers.price),
    currency: String(offers.priceCurrency ?? "USD"),
    images,
    variants: [],
    colors: [],
    sizes: [],
    brand: String(brand.name ?? ""),
    category: "",
    sku: String(jsonld.sku ?? ""),
    stock: String(offers.availability ?? "").includes("InStock") ? 999 : 0,
    shipping: { from_country: "Unknown", delivery_time: "7-14 days" },
    reviews: {
      total: parseInt(String(agg.reviewCount ?? "0"), 10) || 0,
      average_rating: num(agg.ratingValue),
      items: [],
    },
    specs: {},
    source_platform: "universal",
    source_url: url,
    basePrice: 0,
    costPrice: 0,
    suggested_price: 0,
    profit_per_sale: 0,
    roi: 0,
    tags: [],
    ai_title: "",
  }
}

async function aiRewriteTitle(title: string): Promise<string> {
  return title
    .replace(/AliExpress|Amazon|Hot Sale|New|2026|Best|Cheap/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80)
}

function detectCategory(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase()
  if (/car|auto|vehicle/.test(t)) return "Automotive"
  if (/phone|cable|charger|electronic/.test(t)) return "Electronics"
  if (/dress|shirt|shoe|fashion/.test(t)) return "Fashion"
  if (/home|kitchen|garden/.test(t)) return "Home & Garden"
  return "General"
}

function generateSEOTags(title: string, category: string): string[] {
  const words = title.toLowerCase().split(" ").filter((w) => w.length > 3)
  return [category.toLowerCase(), ...words.slice(0, 5)]
}

function calculateQualityScore(p: UniversalProduct): number {
  let score = 0
  if (p.title.length > 20) score += 20
  if (p.images.length >= 3) score += 20
  if (p.variants.length > 1) score += 20
  if (num(p.reviews?.total) > 100) score += 20
  if (p.description.length > 100) score += 20
  return score
}
