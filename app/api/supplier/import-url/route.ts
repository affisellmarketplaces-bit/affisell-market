import * as cheerio from "cheerio"
import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"

type VariantRow = { name: string; image: string; price: number; stock: number }

type ScrapedProduct = {
  title: string
  price: number
  original_price: number
  currency: string
  image: string
  images: string[]
  description: string
  category: string
  variants: VariantRow[]
  sku: string
  stock: number
  source_url: string
}

function normalizeLdImages(raw: unknown): string[] {
  if (!raw) return []
  if (typeof raw === "string" && raw.trim()) return [raw.trim()]
  if (Array.isArray(raw)) {
    const urls: string[] = []
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) urls.push(item.trim())
      else if (item && typeof item === "object" && "url" in item) {
        const u = String((item as { url: unknown }).url).trim()
        if (u) urls.push(u)
      }
    }
    return urls
  }
  if (typeof raw === "object" && raw !== null && "url" in raw) {
    const u = String((raw as { url: unknown }).url).trim()
    return u ? [u] : []
  }
  return []
}

function ldCategory(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 200)
  if (Array.isArray(raw) && raw.length > 0) return ldCategory(raw[0])
  if (raw && typeof raw === "object" && "name" in raw) {
    const n = (raw as { name?: unknown }).name
    return typeof n === "string" ? n.trim().slice(0, 200) : ""
  }
  return ""
}

function mapImagesHd(urls: string[]): string[] {
  return urls
    .filter(Boolean)
    .map((img) => {
      let x = typeof img === "string" ? img.trim() : ""
      if (!x) return ""
      if (!/^https?:/i.test(x)) x = `https:${x}`
      return x.replace(/_\d+x\d+\./, "_960x960.")
    })
    .filter(Boolean)
}

/** Balanced-json slice after `window.runParams =`. Best-effort for AliExpress PDP. */
function extractAliExpressRunParams(html: string): Record<string, unknown> | null {
  const rx = /window\.runParams\s*=/
  const m = rx.exec(html)
  if (!m || m.index === undefined) return null
  const startBrace = html.indexOf("{", m.index)
  if (startBrace === -1) return null
  let depth = 0
  for (let i = startBrace; i < html.length; i++) {
    const c = html[i]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(startBrace, i + 1)) as Record<string, unknown>
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function mergeAliExpressRunParams(html: string, product: ScrapedProduct): void {
  const data = extractAliExpressRunParams(html)
  if (!data) return

  try {
    const root = data as { data?: { root?: { fields?: Record<string, unknown> } } }
    const fields = root?.data?.root?.fields
    if (!fields || typeof fields !== "object") return

    const subject =
      typeof fields.subject === "string" ? fields.subject.trim() : ""
    if (subject) product.title = subject

    const priceBlock = fields.price as Record<string, unknown> | undefined
    if (priceBlock && typeof priceBlock === "object") {
      const min =
        (priceBlock.minAmount as { value?: unknown } | undefined)?.value ??
        (priceBlock.salePrice as { value?: unknown } | undefined)?.value
      const max = (priceBlock.maxAmount as { value?: unknown } | undefined)?.value
      const pMin = typeof min === "number" ? min : parseFloat(String(min ?? ""))
      const pMax = typeof max === "number" ? max : parseFloat(String(max ?? ""))
      if (Number.isFinite(pMin) && pMin > 0) product.price = pMin
      if (Number.isFinite(pMax) && pMax > 0 && pMax !== pMin)
        product.original_price = pMax
    }

    const imgList = fields.imagePathList ?? fields.images
    if (Array.isArray(imgList)) {
      const strs = imgList
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
      if (strs.length > 0) product.images = strs
    }

    const qty = fields.quantity as Record<string, unknown> | undefined
    if (qty && typeof qty === "object") {
      const total = qty.totalAvailable
      const ta =
        typeof total === "number" ? total : parseInt(String(total ?? ""), 10)
      if (Number.isFinite(ta) && ta > 0) product.stock = ta
    }

    const skuProps = fields.skuPropertyList
    if (Array.isArray(skuProps)) {
      product.variants = []
      const basePrice =
        typeof product.price === "number" && product.price > 0 ? product.price : 0
      for (const prop of skuProps) {
        if (!prop || typeof prop !== "object") continue
        const values =
          (
            prop as {
              skuPropertyValues?: Array<Record<string, unknown>>
            }
          ).skuPropertyValues ?? []
        for (const val of values) {
          const nameRaw =
            (val.propertyValueDisplayName as string | undefined) ??
            (val.propertyValueDefinitionName as string | undefined)
          const displayName =
            typeof nameRaw === "string" ? nameRaw.trim() : ""
          if (!displayName) continue
          const imgPathRaw = val.skuPropertyImagePath
          let vimg =
            typeof imgPathRaw === "string" ? imgPathRaw.trim().slice(0, 2000) : ""
          if (vimg && !/^https?:/i.test(vimg)) vimg = `https:${vimg}`
          product.variants.push({
            name: displayName.slice(0, 200),
            image: vimg,
            price: basePrice,
            stock: 50,
          })
        }
      }
    }
  } catch {
    /* ignore malformed runParams */
  }
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

function pickPriceFromOffers(
  offers: unknown
): { price: number; inStockGuess: number; currency: string; referencePrice: number } {
  if (!offers)
    return {
      price: 0,
      inStockGuess: 99,
      currency: "EUR",
      referencePrice: 0,
    }

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

  let salePrice = 0
  let referencePrice = 0
  let currency = "EUR"
  let anyInStock = false
  let anyOut = false

  const num = (v: unknown): number =>
    parseFloat(String(v ?? "").replace(/\s+/g, "").replace(",", ".")) || 0

  for (const o of list) {
    if (typeof o !== "object" || !o) continue
    const obj = o as Record<string, unknown>
    const py = num(obj.price)
    const low = num(obj.lowPrice)
    const high = num(obj.highPrice)

    let rowSale = py || low
    if (!(rowSale > 0)) rowSale = high

    if (rowSale > 0)
      salePrice = salePrice === 0 ? rowSale : Math.min(salePrice, rowSale)

    if (high > referencePrice) referencePrice = high

    const cy = obj.priceCurrency
    if (typeof cy === "string" && /^[A-Z]{3}$/i.test(cy.trim()))
      currency = cy.trim().toUpperCase()

    const avail = String(obj.availability ?? "")
    if (/InStock|PreOrder/i.test(avail)) anyInStock = true
    if (/OutOfStock|SoldOut|Discontinued/i.test(avail)) anyOut = true
  }

  const price = salePrice

  let inStockGuess = 99
  if (anyOut && !anyInStock) inStockGuess = 0
  else if (anyOut) inStockGuess = anyInStock ? 50 : 0

  return { price, inStockGuess, currency, referencePrice }
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

      const imgs = normalizeLdImages(node.image)
      if (imgs.length > 0) {
        out.images = imgs
        out.image = imgs[0] ?? ""
      }

      const cat = ldCategory(node.category)
      if (cat) out.category = cat

      const { price, inStockGuess, currency, referencePrice } =
        pickPriceFromOffers(node.offers)
      if (price > 0) out.price = price
      if (referencePrice > 0 && referencePrice >= (out.price ?? 0))
        out.original_price = Math.max(out.original_price ?? 0, referencePrice)
      out.stock = inStockGuess
      if (currency) out.currency = currency
      if (typeof node.sku === "string" && node.sku) out.sku = node.sku
      if (typeof node.mpn === "string" && node.mpn?.trim())
        out.sku = out.sku || node.mpn.trim()

      if (
        out.title ||
        out.description ||
        (out.price !== undefined && out.price > 0) ||
        (out.images && out.images.length > 0) ||
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
  const priceNum = Number.isFinite(p.price) ? p.price : 0
  let orig =
    Number.isFinite(p.original_price) && p.original_price > 0
      ? p.original_price
      : priceNum
  if (orig < priceNum) orig = priceNum

  let imgList =
    Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : p.image
        ? [p.image]
        : []
  imgList = mapImagesHd(imgList)
  const leadImage = imgList[0] ?? p.image ?? ""

  const variantCount = p.variants.length > 0 ? p.variants.length : 1
  const suggested = parseFloat((priceNum * 1.5).toFixed(2))

  return NextResponse.json({
    success: true,
    products: [
      {
        title: p.title.slice(0, 200),
        price: parseFloat(priceNum.toFixed(4)),
        original_price: parseFloat(orig.toFixed(4)),
        currency: (p.currency || "EUR").slice(0, 12),
        images: imgList,
        image: leadImage,
        description: typeof p.description === "string" ? p.description.slice(0, 2000) : "",
        variants: p.variants,
        variants_count: variantCount,
        stock: p.stock || 99,
        sku: (p.sku || "").slice(0, 120),
        source_url: p.source_url,
        category: typeof p.category === "string" ? p.category.slice(0, 200) : "",
        suggested_price: suggested,
        suggested_commission: 20,
        selected: true as const,
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
      original_price: 0,
      currency: "EUR",
      image: "",
      images: [],
      description: "",
      category: "",
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

      mergeAliExpressRunParams(html, product)

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

      if (product.variants.length === 0) {
        $(".sku-property-list.sku-property-item").each((_, el) => {
          const name = $(el).find(".sku-property-text").text().trim()
          const imgRaw = $(el).find("img").attr("src")
          let vimg = imgRaw ?? ""
          if (vimg && !/^https?:/i.test(vimg)) vimg = `https:${vimg}`
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

    if (typeof product.description !== "string") product.description = ""
    else if (product.description.length > 2000)
      product.description = product.description.slice(0, 2000)

    product.stock = product.stock || 99

    if ((!product.images || product.images.length === 0) && product.image.trim())
      product.images = [product.image]

    product.images = mapImagesHd(product.images ?? [])

    if (product.images[0]) product.image = product.images[0]

    if (!product.original_price || product.original_price < product.price)
      product.original_price = product.price

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
