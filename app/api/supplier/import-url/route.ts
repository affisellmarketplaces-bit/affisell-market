import * as cheerio from "cheerio"
import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"

type VariantRow = { name: string; image: string; price: number; stock: number }

type ScrapedProduct = {
  title: string
  price: number
  image: string
  images: string[]
  description: string
  variants: VariantRow[]
  sku: string
  stock: number
  source_url: string
}

function collectLdNodes(parsed: unknown): Record<string, unknown>[] {
  if (parsed === null || parsed === undefined) return []
  if (Array.isArray(parsed))
    return parsed.flatMap((p) => collectLdNodes(p))
  if (typeof parsed === "object" && "@graph" in (parsed as object)) {
    return collectLdNodes((parsed as { "@graph": unknown })["@graph"])
  }
  if (typeof parsed === "object" && parsed !== null)
    return [parsed as Record<string, unknown>]
  return []
}

function isProductLd(node: Record<string, unknown>): boolean {
  const t = node["@type"]
  if (t === "Product") return true
  if (Array.isArray(t)) return t.some((x) => x === "Product")
  return false
}

function normalizeLdImage(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0]
    if (typeof first === "string") return first
    if (typeof first === "object" && first !== null && "url" in first)
      return String((first as { url: unknown }).url)
  }
  if (typeof raw === "object" && raw !== null && "url" in raw)
    return String((raw as { url: unknown }).url)
  return ""
}

function pickPriceFromOffers(
  offers: unknown
): { price: number; inStockGuess: number } {
  if (!offers) return { price: 0, inStockGuess: 99 }

  const list = Array.isArray(offers)
    ? offers
    : typeof offers === "object" && "@graph" in (offers as object)
      ? collectLdNodes(offers).filter((o) => {
          const t = (o["@type"] as unknown) ?? o["type"]
          if (t === "Offer" || t === "AggregateOffer") return true
          if (Array.isArray(t))
            return t.includes("Offer") || t.includes("AggregateOffer")
          return false
        })
      : [offers]

  let price = 0
  let anyInStock = false
  let anyOut = false

  for (const o of list) {
    if (typeof o !== "object" || !o) continue
    const obj = o as Record<string, unknown>
    const cand =
      parseFloat(String(obj.price ?? "").replace(",", ".")) ||
      parseFloat(String(obj.lowPrice ?? "").replace(",", ".")) ||
      parseFloat(String(obj.highPrice ?? "").replace(",", "."))
    if (Number.isFinite(cand) && cand > 0) price = cand
    const avail = String(obj.availability ?? "")
    if (/InStock|PreOrder/i.test(avail)) anyInStock = true
    if (/OutOfStock|SoldOut|Discontinued/i.test(avail)) anyOut = true
  }

  let inStockGuess = 99
  if (anyOut && !anyInStock) inStockGuess = 0
  else if (anyOut) inStockGuess = anyInStock ? 50 : 0

  return { price, inStockGuess }
}

function parseEuNumber(text: string): number {
  const t = text.replace(/[^\d.,]/g, "").trim()
  if (!t) return 0
  if (t.includes(",") && t.includes("."))
    return parseFloat(t.replace(/\./g, "").replace(",", "."))
  if (t.includes(",")) return parseFloat(t.replace(",", "."))
  return parseFloat(t)
}

function scrapeJsonLd($: cheerio.CheerioAPI): {
  product: Partial<ScrapedProduct>
  used: boolean
} {
  const out: Partial<ScrapedProduct> = {}
  let used = false

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html()?.trim()
    if (!raw) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    const nodes = collectLdNodes(parsed)
    for (const node of nodes) {
      if (!isProductLd(node)) continue
      if (typeof node.name === "string" && node.name) out.title = node.name
      if (typeof node.description === "string" && node.description)
        out.description = node.description
      const img = normalizeLdImage(node.image)
      if (img) {
        out.image = img
        out.images = [img]
      }
      const { price, inStockGuess } = pickPriceFromOffers(node.offers)
      if (price > 0) out.price = price
      out.stock = inStockGuess
      if (typeof node.sku === "string" && node.sku) out.sku = node.sku
      if (
        out.title ||
        out.description ||
        (out.price !== undefined && out.price > 0) ||
        out.image
      )
        used = true
    }
  })

  return { product: out, used }
}

function toPreviewResponse(
  p: ScrapedProduct,
  precision: string,
  extraction_method: string
) {
  const variantCount =
    p.variants.length > 0 ? p.variants.length : 1

  const priceNum = Number.isFinite(p.price) ? p.price : 0

  return NextResponse.json({
    products: [
      {
        title: p.title.slice(0, 200),
        price: priceNum.toFixed(2),
        image: p.image,
        description: p.description.slice(0, 2000),
        variants: variantCount,
        stock: p.stock || 99,
        sku: p.sku,
      },
    ],
    precision,
    extraction_method,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let url = ""
  try {
    const body = (await req.json()) as { url?: string }
    url = typeof body.url === "string" ? body.url.trim() : ""
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const response = await fetch(parsedUrl.href, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 500 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    let extraction_method = "fallback"

    const product: ScrapedProduct = {
      title: "",
      price: 0,
      image: "",
      images: [],
      description: "",
      variants: [],
      sku: "",
      stock: 0,
      source_url: url,
    }

    const jsonLdResult = scrapeJsonLd($)
    if (jsonLdResult.used) extraction_method = "json-ld"
    Object.assign(product, jsonLdResult.product)

    if (!product.title) {
      product.title =
        $('meta[property="og:title"]').attr("content") ??
        $('meta[name="title"]').attr("content") ??
        ""
      if (product.title) extraction_method = "opengraph-meta"
    }
    if (!product.image) {
      product.image =
        $('meta[property="og:image"]').attr("content") ??
        $('meta[property="product:image"]').attr("content") ??
        ""
      if (product.image && extraction_method === "fallback")
        extraction_method = "opengraph-meta"
    }
    if (!product.price || product.price === 0) {
      const priceMeta =
        $('meta[property="product:price:amount"]').attr("content") ??
        $('meta[property="og:price:amount"]').attr("content")
      const n = parseFloat(String(priceMeta ?? "").replace(",", "."))
      if (Number.isFinite(n) && n > 0) {
        product.price = n
        if (extraction_method === "fallback") extraction_method = "opengraph-meta"
      }
    }

    /* AliExpress */
    if (/aliexpress\./i.test(parsedUrl.hostname)) {
      extraction_method =
        extraction_method === "json-ld" ? "json-ld+aliexpress" : "aliexpress"

      const productIdMatch = url.match(/\/item\/(?:\d+\.)?(\d+)\.html/)
      if (productIdMatch?.[1] && !product.sku)
        product.sku = `AE-${productIdMatch[1]}`

      if (!product.title) {
        product.title =
          $('h1[data-pl="product-title"]').text().trim() ||
          $(".product-title-text").text().trim()
      }

      if (!product.price || product.price === 0) {
        const priceSelectors = [
          ".product-price-value",
          ".uniform-banner-box-price",
          ".price-default--current--F8oaM3Z",
          '[class*="price-current"]',
        ]
        for (const sel of priceSelectors) {
          const priceText = $(sel).first().text().trim()
          if (priceText) {
            const n = parseEuNumber(priceText)
            if (n > 0) {
              product.price = n
              break
            }
          }
        }
      }

      const imageUrls = new Set<string>()
      $("img.detail-gallery-turn-image, img.magnifier-image").each((_, el) => {
        let src = $(el).attr("src") ?? $(el).attr("data-src")
        if (src) {
          if (!src.startsWith("http")) src = `https:${src}`
          imageUrls.add(src.replace(/_\d+x\d+\./, "_960x960."))
        }
      })
      product.images = Array.from(imageUrls)
      if (product.images[0]) product.image = product.images[0]

      $(".sku-property-list.sku-property-item").each((_, el) => {
        const name = $(el).find(".sku-property-text").text().trim()
        const imgRaw = $(el).find("img").attr("src")
        let vimg = imgRaw ?? ""
        if (vimg && !vimg.startsWith("http")) vimg = `https:${vimg}`
        if (name) {
          product.variants.push({
            name,
            image: vimg,
            price: product.price || 0,
            stock: 50,
          })
        }
      })
    }

    /* Amazon */
    if (/amazon\./i.test(parsedUrl.hostname)) {
      extraction_method =
        extraction_method.startsWith("json-ld") ? extraction_method + "+amazon" : "amazon"

      const amzTitle = $("#productTitle").text().trim()
      if (amzTitle) product.title = amzTitle

      const whole = $("#corePrice_feature_div .a-price-whole")
        .first()
        .text()
        .replace(/[^\d]/g, "")
      const frac = $("#corePrice_feature_div .a-price-fraction")
        .first()
        .text()
        .replace(/\D/g, "")
      const amzWhole = parseInt(whole, 10)
      const amzFrac = frac ? parseInt(frac.padEnd(2, "0").slice(0, 2), 10) / 100 : 0
      const amzPrice =
        (Number.isFinite(amzWhole) ? amzWhole : 0) + (Number.isFinite(amzFrac) ? amzFrac : 0)
      if (amzPrice > 0 && (!product.price || product.price === 0))
        product.price = amzPrice

      const landing = $("#landingImage").attr("src")
      if (landing) product.image = landing

      try {
        const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
        if (asinMatch?.[1] && !product.sku) product.sku = asinMatch[1]
      } catch {
        /* ignore */
      }
    }

    /* Shopify theme JSON */
    const host = parsedUrl.hostname
    const isShopifyLike =
      host.endsWith(".myshopify.com") ||
      $("script[data-product-json][type=\"application/json\"]").length > 0

    if (
      isShopifyLike ||
      parsedUrl.pathname.includes("/products/")
    ) {
      const themeJsonRaw = $("script[data-product-json][type=\"application/json\"]")
        .first()
        .html()

      if (themeJsonRaw) {
        try {
          const data = JSON.parse(themeJsonRaw) as {
            title?: string
            price?: number
            images?: string[]
            variants?: Array<{
              title?: string
              price?: number
              sku?: string
              inventory_quantity?: number
            }>
          }
          if (data.title) product.title = data.title
          if (typeof data.price === "number" && data.price > 0)
            product.price = data.price / 100
          if (Array.isArray(data.images) && data.images.length > 0) {
            product.images = data.images
            product.image = data.images[0] ?? product.image
          }
          if (Array.isArray(data.variants)) {
            product.variants = data.variants.map((v) => ({
              name: v.title ?? v.sku ?? "",
              image: "",
              price:
                typeof v.price === "number" ? v.price / 100 : product.price,
              stock:
                typeof v.inventory_quantity === "number"
                  ? v.inventory_quantity
                  : 0,
            }))
          }
          extraction_method =
            extraction_method.startsWith("json-ld") || extraction_method.includes("+")
              ? `${extraction_method}+shopify`
              : "shopify-theme-json"
        } catch {
          /* ignore */
        }
      }
    }

    if (!product.title?.trim()) {
      return NextResponse.json(
        {
          error:
            "Could not extract product data. Site may block scraping.",
        },
        { status: 422 }
      )
    }

    if (typeof product.description === "string" && product.description.length > 2000)
      product.description = product.description.slice(0, 2000)

    product.stock = product.stock || 99

    return toPreviewResponse(product, "high", extraction_method)
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : "Unknown error",
        suggestion: "Try using the manual CSV import instead",
      },
      { status: 500 }
    )
  }
}
