import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

type ReviewSentiment = "positive" | "neutral" | "negative"

type AliVariant = {
  name: string
  type: string
  image: string
  price: number
  stock: number
  sku: string
  attributes: Record<string, string>
}

type UniversalProduct = {
  title: string
  description: string
  price: number
  original_price: number
  currency: string
  images: string[]
  variants: AliVariant[]
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
    items: Array<{
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
    }>
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

function detectPlatform(url: string): string {
  if (url.includes("aliexpress.com")) return "aliexpress"
  if (url.includes("amazon.")) return "amazon"
  if (url.includes("/products/") || url.includes("myshopify.com")) return "shopify"
  return "universal"
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function toHdImage(raw: string): string {
  const s = raw.trim()
  if (!s) return ""
  const withProto = s.startsWith("http") ? s : `https:${s}`
  return withProto.replace(/_\d+x\d+\./, "_960x960.")
}

function extractJsonAfterKey(
  content: string,
  key: RegExp
): Record<string, unknown> | null {
  const m = key.exec(content)
  if (!m || m.index === undefined) return null
  const start = content.indexOf("{", m.index)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < content.length; i++) {
    if (content[i] === "{") depth++
    else if (content[i] === "}") {
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

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string }
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }
    const platform = detectPlatform(url)

    if (platform === "aliexpress") {
      const product = await scrapeAliExpressReal(url)
      if (!product.title) throw new Error("AliExpress blocked - no data found")
      return NextResponse.json({
        products: [product],
        success: true,
        platform: "aliexpress",
      })
    }

    return NextResponse.json(
      { error: "Platform not implemented in this route revision" },
      { status: 422 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 422 }
    )
  }
}

async function scrapeAliExpressReal(url: string): Promise<UniversalProduct> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(25000),
  })

  const html = await res.text()
  const $ = cheerio.load(html)

  let aerData: Record<string, unknown> | null = null
  for (const script of $("script").toArray()) {
    const content = $(script).html() || ""
    if (!content.includes("__AER_DATA__")) continue
    aerData =
      extractJsonAfterKey(content, /window\.__AER_DATA__\s*=/) ??
      extractJsonAfterKey(content, /window\[['"]__AER_DATA__['"]\]\s*=/)
    if (aerData) break
  }

  if (!aerData) throw new Error("__AER_DATA__ not found - AliExpress blocked")

  const p = asRec(aerData.pageModule)
  const productInfo = asRec(asRec(p.productInfoComponent).productInfo)
  const skuModule = asRec(asRec(p.skuComponent).skuModule)
  const reviewModule = asRec(asRec(p.reviewComponent).reviewModule)
  const shippingModule = asRec(asRec(p.shippingComponent).shippingModule)
  const freightInfo = asRec(shippingModule.generalFreightInfo)

  const skuPriceList = Array.isArray(skuModule.skuPriceList)
    ? skuModule.skuPriceList
    : []
  const prices = skuPriceList
    .map((raw) => {
      const skuVal = asRec(asRec(raw).skuVal)
      return (
        num(asRec(skuVal.skuActivityAmount).value) ||
        num(asRec(skuVal.skuAmount).value)
      )
    })
    .filter((v) => v > 0)

  const variants: AliVariant[] = (
    Array.isArray(skuModule.productSKUPropertyList)
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
        ? toHdImage(txt(v.skuPropertyImagePath))
        : ""
      const valueId = txt(v.propertyValueId)
      return {
        name,
        type: propName,
        image,
        price: prices[0] || 0,
        stock: 50,
        sku: `AE-${valueId}`,
        attributes: { [propName]: name },
      }
    })
  })

  const starLevel = asRec(reviewModule.starLevel)
  const avgRating = num(reviewModule.averageStar)
  const reviewList = Array.isArray(reviewModule.reviewList)
    ? reviewModule.reviewList
    : []

  return {
    title: txt(productInfo.subject),
    description: txt(productInfo.description),
    price: prices.length ? Math.min(...prices) : 0,
    original_price: prices.length ? Math.max(...prices) : 0,
    currency: "USD",
    images: (Array.isArray(productInfo.imagePathList)
      ? productInfo.imagePathList
      : []
    )
      .filter((i): i is string => typeof i === "string")
      .map((i) => toHdImage(i))
      .slice(0, 10),
    variants,
    colors: variants.filter((v) => v.type.toLowerCase().includes("color")).map((v) => ({
      name: v.name,
      image: v.image,
      hex: "#CCCCCC",
    })),
    sizes: variants
      .filter(
        (v) =>
          v.type.toLowerCase().includes("size") ||
          v.type.toLowerCase().includes("length")
      )
      .map((v) => ({ name: v.name, value: v.name })),
    brand: txt(productInfo.storeName),
    category: "",
    sku: `AE-${url.match(/item\/(\d+)\.html/)?.[1] ?? ""}`,
    stock: num(productInfo.totalAvailQuantity) || 999,
    shipping: {
      from_country: txt(freightInfo.shipFrom) || "China",
      delivery_time: txt(freightInfo.deliveryTimeDesc) || "15-25 days",
      shipping_cost: 0,
      carrier: "Standard",
    },
    reviews: {
      total: num(reviewModule.totalValidNum) || 0,
      average_rating: avgRating,
      breakdown: {
        5: num(starLevel.fiveStarNum) || 0,
        4: num(starLevel.fourStarNum) || 0,
        3: num(starLevel.threeStarNum) || 0,
        2: num(starLevel.twoStarNum) || 0,
        1: num(starLevel.oneStarNum) || 0,
      },
      items: reviewList.slice(0, 50).map((raw) => {
        const r = asRec(raw)
        const rating = Math.max(1, Math.min(5, Math.round(num(r.star) || 5)))
        return {
          rating,
          author: txt(r.buyerName) || "Anonymous",
          country: txt(r.buyerCountry),
          date: txt(r.reviewDate) || new Date().toISOString(),
          text: txt(r.reviewContent) || txt(r.buyerFeedback),
          images: (Array.isArray(r.images) ? r.images : [])
            .filter((i): i is string => typeof i === "string")
            .map((i) => toHdImage(i)),
          variant: txt(r.skuInfo),
          helpful_count: Math.max(0, Math.round(num(r.thumbUpNum) || 0)),
          verified: true,
          sentiment: rating >= 4 ? "positive" : rating >= 3 ? "neutral" : "negative",
        }
      }),
      sentiment: avgRating >= 4 ? "positive" : "neutral",
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
