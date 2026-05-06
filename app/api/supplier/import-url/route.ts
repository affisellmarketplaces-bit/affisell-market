import * as cheerio from "cheerio"
import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"

/** One selectable option/value from a PDP (color chip, size, etc.). */
type ScrapedVariant = {
  name: string
  image: string
  price: number
  stock: number
  /** e.g. "Color", "Shoe Size" */
  type?: string
  /** Platform-specific option id where available */
  sku?: string
}

type ScrapedColor = { name: string; hex: string; image: string }

type ScrapedShipping = {
  from_country: string
  delivery_time: string
  shipping_cost: number
  processing_time: string
}

type ScrapedProduct = {
  title: string
  description: string
  price: number
  original_price: number
  currency: string
  image: string
  images: string[]
  category: string
  variants: ScrapedVariant[]
  colors: ScrapedColor[]
  sizes: string[]
  sku: string
  stock: number
  shipping: ScrapedShipping
  specs: Record<string, string>
  source_url: string
}

const IMPORT_MARKUP = 1.6
const IMPORT_COMMISSION_HINT = 25

function defaultShipping(): ScrapedShipping {
  return {
    from_country: "China",
    delivery_time: "15–25 days",
    shipping_cost: 0,
    processing_time: "1–3 days",
  }
}

function numUnknown(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(/\s+/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function uniqStrings(items: string[], cap = 80): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of items) {
    const t = typeof s === "string" ? s.trim() : ""
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t.slice(0, 240))
    if (out.length >= cap) break
  }
  return out
}

function aeHexPlaceholder(): string {
  return "#CCCCCC"
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

function pickAeFields(run: Record<string, unknown>): Record<string, unknown> | null {
  const d = run.data
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const data = d as Record<string, unknown>
    const root = data.root
    if (root && typeof root === "object") {
      const fields = (root as { fields?: unknown }).fields
      if (fields && typeof fields === "object" && !Array.isArray(fields))
        return fields as Record<string, unknown>
    }
    const pic = data.productInfoComponent
    if (pic && typeof pic === "object" && !Array.isArray(pic))
      return pic as Record<string, unknown>
  }
  return null
}

function mergeAliExpressRunParams(html: string, product: ScrapedProduct): void {
  const data = extractAliExpressRunParams(html)
  if (!data) return

  try {
    const fields = pickAeFields(data)
    if (!fields) return

    const subject =
      typeof fields.subject === "string"
        ? fields.subject.trim()
        : typeof fields.title === "string"
          ? fields.title.trim()
          : ""
    if (subject) product.title = subject

    const descRaw = fields.description
    if (
      typeof descRaw === "string" &&
      descRaw.trim().length > (product.description?.length ?? 0)
    ) {
      product.description = descRaw.trim()
    }

    const priceBlock = fields.price as Record<string, unknown> | undefined
    if (priceBlock && typeof priceBlock === "object") {
      const act = priceBlock.minActivityAmount as { value?: unknown } | undefined
      const mn = priceBlock.minAmount as { value?: unknown } | undefined
      const sale = priceBlock.salePrice as { value?: unknown } | undefined
      const mx = priceBlock.maxAmount as { value?: unknown } | undefined

      const pSale =
        numUnknown(act?.value) ||
        numUnknown(mn?.value) ||
        numUnknown(sale?.value)

      const pOrig = numUnknown(mx?.value)

      if (pSale > 0) {
        product.price = pSale
        if (!(pOrig > 0)) product.original_price = pSale
        else product.original_price = Math.max(pOrig, pSale)
      } else if (pOrig > 0) {
        product.original_price = pOrig
        product.price = pOrig
      }
    }

    const imgSrcs = fields.imagePathList ?? fields.images
    if (Array.isArray(imgSrcs)) {
      const strs = imgSrcs
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
      if (strs.length > 0) product.images = strs
    }

    const qty = fields.quantity as Record<string, unknown> | undefined
    if (qty && typeof qty === "object") {
      const total = qty.totalAvailable
      const ta =
        typeof total === "number" ? total : parseInt(String(total ?? ""), 10)
      if (Number.isFinite(ta) && ta > 0) product.stock = Math.min(Math.max(ta, 1), 999_999)
    }

    /* Shipping */
    const del = fields.delivery as Record<string, unknown> | undefined
    if (del && typeof del === "object") {
      const shipFromRaw = del.shipFrom
      if (typeof shipFromRaw === "string" && shipFromRaw.trim())
        product.shipping.from_country = shipFromRaw.trim()
      const dd = del.deliveryTimeDesc
      if (typeof dd === "string" && dd.trim())
        product.shipping.delivery_time = dd.trim()
      const pt = del.processingTime
      if (typeof pt === "string" && pt.trim())
        product.shipping.processing_time = pt.trim()
    }

    const freight = fields.freightAmount as Record<string, unknown> | undefined
    if (freight && freight.value != null)
      product.shipping.shipping_cost = numUnknown(freight.value)

    /* Specs table */
    const propList = fields.productPropList
    if (Array.isArray(propList)) {
      for (const raw of propList) {
        if (!raw || typeof raw !== "object") continue
        const row = raw as Record<string, unknown>
        const k =
          typeof row.attrName === "string"
            ? row.attrName.trim()
            : typeof row.name === "string"
              ? row.name.trim()
              : ""
        if (!k || k.length > 200) continue
        const aval = row.attrValue
        let v = ""
        if (typeof aval === "string") v = aval.trim()
        else if (Array.isArray(aval))
          v = aval
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter(Boolean)
            .join(", ")
        else if (aval != null) v = String(aval).trim()
        if (v) product.specs[k.slice(0, 200)] = v.slice(0, 1200)
      }
    }

    const catNm = fields.categoryName
    if (typeof catNm === "string" && catNm.trim())
      product.category = catNm.trim().slice(0, 240)

    const pidRaw = fields.productId
    const productId =
      typeof pidRaw === "number"
        ? String(pidRaw)
        : typeof pidRaw === "string"
          ? pidRaw.trim()
          : ""

    const skuProps = fields.skuPropertyList
    if (Array.isArray(skuProps)) {
      product.variants = []
      product.colors = []
      const sizeAcc: string[] = []
      const basePrice =
        typeof product.price === "number" && product.price > 0 ? product.price : 0
      for (const prop of skuProps) {
        if (!prop || typeof prop !== "object") continue
        const typed = prop as {
          skuPropertyName?: unknown
          skuPropertyValues?: Array<Record<string, unknown>>
        }
        const propName =
          typeof typed.skuPropertyName === "string"
            ? typed.skuPropertyName.trim()
            : ""
        const pl = propName.toLowerCase()

        const values = typed.skuPropertyValues ?? []
        for (const val of values) {
          const nameRaw =
            (val.propertyValueDisplayName as string | undefined) ??
            (val.propertyValueDefinitionName as string | undefined)
          const displayName =
            typeof nameRaw === "string" ? nameRaw.trim() : ""
          if (!displayName) continue
          const vid = val.propertyValueId ?? val.variationId ?? val.definitionId

          let vimgRaw =
            typeof val.skuPropertyImagePath === "string"
              ? val.skuPropertyImagePath.trim().slice(0, 2000)
              : ""
          if (vimgRaw && !/^https?:/i.test(vimgRaw)) vimgRaw = `https:${vimgRaw}`

          const lineSku =
            productId && vid != null
              ? `${productId}-${String(vid)}`.slice(0, 120)
              : undefined

          product.variants.push({
            name: displayName.slice(0, 200),
            image: vimgRaw,
            price: basePrice,
            stock: 50,
            type: propName || undefined,
            sku: lineSku,
          })

          if (/(color|colour)/i.test(pl)) {
            product.colors.push({
              name: displayName.slice(0, 120),
              hex: aeHexPlaceholder(),
              image: vimgRaw,
            })
          } else if (/(size|shoe\s*size|length|capacity)/i.test(pl)) {
            sizeAcc.push(displayName)
          }
        }
      }
      product.sizes = uniqStrings(sizeAcc, 120)
      if (!product.colors.length && sizeAcc.length) {
        /* only sizes */
      }

      const seenColor = new Set<string>()
      product.colors = product.colors.filter((c) => {
        if (seenColor.has(c.name)) return false
        seenColor.add(c.name)
        return true
      })
      if (productId && !product.sku) product.sku = `AE-${productId}`
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
      if (typeof node.description === "string" && node.description) {
        const d = node.description.trim()
        if (d.includes("<")) {
          const dh = cheerio.load(d)
          out.description = dh
            .root()
            .text()
            .replace(/\s+/g, " ")
            .trim()
        } else out.description = d
      }

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
  imgList = mapImagesHd(uniqStrings(imgList, 30)).slice(0, 10)
  const leadImage = imgList[0] ?? p.image ?? ""

  const variantCount = p.variants.length > 0 ? p.variants.length : 1

  const suggested = parseFloat((priceNum * IMPORT_MARKUP).toFixed(2))
  const profit_per_sale = (suggested - priceNum).toFixed(2)

  const extracted_fields: string[] = []
  if ((p.title || "").trim()) extracted_fields.push("title")
  if ((p.description || "").trim()) extracted_fields.push("description")
  if (priceNum > 0) extracted_fields.push("price")
  if (orig > priceNum + 1e-6) extracted_fields.push("original_price")
  if (imgList.length > 0) extracted_fields.push("images")
  if (p.variants.length > 0) extracted_fields.push("variants")
  if (p.colors.length > 0) extracted_fields.push("colors")
  if (p.sizes.length > 0) extracted_fields.push("sizes")
  extracted_fields.push("shipping")
  if (Object.keys(p.specs).length > 0) extracted_fields.push("specs")
  if ((p.sku || "").trim()) extracted_fields.push("sku")
  if ((p.category || "").trim()) extracted_fields.push("category")

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
        description:
          typeof p.description === "string" ? p.description.slice(0, 5000) : "",
        variants: p.variants,
        variants_count: variantCount,
        colors: p.colors,
        sizes: p.sizes,
        shipping: p.shipping,
        specs: p.specs,
        stock: p.stock || 99,
        sku: (p.sku || "").slice(0, 120),
        source_url: p.source_url,
        category: typeof p.category === "string" ? p.category.slice(0, 200) : "",
        suggested_price: suggested,
        suggested_commission: IMPORT_COMMISSION_HINT,
        profit_per_sale,
        selected: true as const,
      },
    ],
    precision,
    extraction_method,
    extracted_fields,
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
      description: "",
      price: 0,
      original_price: 0,
      currency: "EUR",
      image: "",
      images: [],
      category: "",
      variants: [],
      colors: [],
      sizes: [],
      sku: "",
      stock: 0,
      shipping: defaultShipping(),
      specs: {},
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

      const domImgs: string[] = []
      $("img.detail-gallery-turn-image, img.magnifier-image").each((_, el) => {
        let src = $(el).attr("src") ?? $(el).attr("data-src")
        if (src) {
          if (!src.startsWith("http")) src = `https:${src}`
          domImgs.push(src.replace(/_\d+x\d+\./, "_960x960."))
        }
      })
      product.images = uniqStrings([...(product.images ?? []), ...domImgs], 40).slice(
        0,
        20
      )
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

      if (!product.description?.trim()) {
        const bullets = $(
          "#feature-bullets ul li, #featurebullets_feature_div ul li, #productFactsDesktopExpander ul li"
        )
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(Boolean)
          .slice(0, 40)

        const proseBlocks = $('#productDescription, #productDescription_feature_div').text().trim()

        const built = bullets.length
          ? `• ${bullets.join("\n• ")}${proseBlocks ? `\n\n${proseBlocks}` : ""}`
          : proseBlocks
        if (built.trim()) product.description = built.trim()
      }

      const amzImgs: string[] = []
      if (landing?.trim())
        amzImgs.push(landing.trim())

      $("li[data-csa-c-action='image-block-alt-image'] img, #altImages li img").each(
        (_, el) => {
          const src =
            $(el).attr("data-src") ??
            $(el).attr("data-old-hires") ??
            $(el).attr("src")
          let s = typeof src === "string" ? src.trim().split(/\s+/)[0] ?? "" : ""
          if (!s.startsWith("http")) s = s ? `https:${s}` : ""
          if (s.length > 8) amzImgs.push(s)
        }
      )
      product.images = uniqStrings(
        [...(product.images.length ? product.images : []), ...amzImgs],
        40
      ).slice(0, 20)
      if (product.images[0]) product.image = product.images[0]

      product.shipping = {
        from_country: "United States",
        delivery_time: "3–10 days",
        shipping_cost: 0,
        processing_time: "1–2 days",
      }

      $("#variation_color_name li, #variation_color_name .selection").each((_, el) => {
        const t = $(el).text().trim()
        if (!t || t.length > 80) return
        if (!product.colors.some((c) => c.name === t))
          product.colors.push({ name: t, hex: aeHexPlaceholder(), image: "" })
      })

      $("#variation_size_name li, #native_dropdown_selected_size_name").each((_, el) => {
        const t = $(el).text().trim()
        if (t && t.length < 64) product.sizes = uniqStrings([...product.sizes, t], 120)
      })

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
          type ShopifyThemeProduct = {
            title?: string
            price?: number | string
            compare_at_price?: number | string | null
            body_html?: string
            description?: string
            images?: Array<string | Record<string, unknown>>
            options?: Array<{ name?: string; values?: string[] | unknown }>
            variants?: Array<Record<string, unknown>>
          }
          const data = JSON.parse(themeJsonRaw) as ShopifyThemeProduct

          if (data.title) product.title = data.title

          const baseCents = numUnknown(data.price)
          if (baseCents > 0) product.price = baseCents / 100
          const cmp = numUnknown(data.compare_at_price ?? 0)
          if (cmp > 0 && cmp / 100 > (product.price ?? 0) + 1e-6)
            product.original_price = cmp / 100

          if (
            !(product.price > 0) &&
            Array.isArray(data.variants) &&
            data.variants[0]
          ) {
            const c0 = numUnknown(data.variants[0].price)
            if (c0 > 0) product.price = c0 / 100
          }

          const htmlDesc =
            typeof data.body_html === "string" ? data.body_html.trim() : ""
          if (!product.description?.trim() && htmlDesc) {
            const hs = cheerio.load(htmlDesc)
            product.description = hs
              .root()
              .text()
              .replace(/\s+/g, " ")
              .trim()
          } else if (
            !product.description?.trim() &&
            typeof data.description === "string"
          ) {
            product.description = data.description.trim()
          }

          if (Array.isArray(data.images) && data.images.length > 0) {
            const imgs = data.images
              .map((im) => {
                if (typeof im === "string") return im.trim()
                if (!im || typeof im !== "object") return ""
                const rec = im as Record<string, unknown>
                const u =
                  typeof rec.src === "string"
                    ? rec.src.trim()
                    : typeof rec.url === "string"
                      ? rec.url.trim()
                      : ""
                return u
              })
              .filter(Boolean)
            product.images = uniqStrings([...imgs, ...product.images], 60).slice(
              0,
              20
            )
            product.image = product.images[0] ?? product.image
          }

          if (Array.isArray(data.options)) {
            for (const opt of data.options) {
              const nm =
                typeof opt?.name === "string" ? opt.name.trim() : ""
              const vals = Array.isArray(opt.values)
                ? opt.values.filter((x): x is string => typeof x === "string")
                : []
              const pl = nm.toLowerCase()
              if (/(color|colour)/i.test(pl)) {
                for (const v of vals)
                  if (!product.colors.some((c) => c.name === v))
                    product.colors.push({
                      name: v.slice(0, 120),
                      hex: aeHexPlaceholder(),
                      image: "",
                    })
              } else if (/(size)/i.test(pl))
                product.sizes = uniqStrings([...product.sizes, ...vals], 120)
              else if (
                /(material|style|pattern)/i.test(pl) &&
                vals.length &&
                product.sizes.length === 0
              )
                product.sizes = uniqStrings([...product.sizes, ...vals], 120)
            }
          }

          if (Array.isArray(data.variants)) {
            product.variants = data.variants.map((v) => {
              const o1 = typeof v.option1 === "string" ? v.option1.trim() : ""
              const o2 = typeof v.option2 === "string" ? v.option2.trim() : ""
              const o3 = typeof v.option3 === "string" ? v.option3.trim() : ""
              const parts = [o1, o2, o3].filter(Boolean)
              const title =
                typeof v.title === "string" ? v.title.trim() : ""
              const nameLabel =
                parts.length > 0 ? parts.join(" / ") : title || "Variant"
              const cents = numUnknown(v.price)
              const inv = v.inventory_quantity
              const st =
                typeof inv === "number"
                  ? inv
                  : parseInt(String(inv ?? ""), 10)

              const line: ScrapedVariant = {
                name: nameLabel.slice(0, 200),
                image: "",
                price: cents > 0 ? cents / 100 : product.price,
                stock: Number.isFinite(st) && st >= 0 ? st : 0,
              }
              if (typeof v.sku === "string" && v.sku.trim())
                line.sku = v.sku.trim().slice(0, 120)
              return line
            })
          }

          product.shipping = {
            from_country: "Shop / warehouse",
            delivery_time: "3–14 days",
            shipping_cost: 0,
            processing_time: "1–3 days",
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
    else if (product.description.length > 5000)
      product.description = product.description.slice(0, 5000)

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
