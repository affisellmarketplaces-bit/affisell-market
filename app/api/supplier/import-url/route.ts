import { existsSync } from "node:fs"

import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"
import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const IMPORT_MARKUP = 1.7
const IMPORT_COMMISSION_HINT = 25

function asRec(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = parseFloat(String(v ?? "").replace(/\s+/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function uniqStrings(items: string[], cap = 120): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of items) {
    const t = s.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t.slice(0, 240))
    if (out.length >= cap) break
  }
  return out
}

function parseSkuPropPairs(skuPropIds: string): Array<{ propId: string; valId: string }> {
  const s = skuPropIds.trim()
  if (!s) return []
  const out: Array<{ propId: string; valId: string }> = []
  for (const part of s.split(/[,;#+]+/)) {
    const seg = part.trim().replace(/^#/, "")
    if (!seg) continue
    const idx = seg.indexOf(":")
    if (idx === -1) continue
    const propId = seg.slice(0, idx).trim()
    const valId = seg.slice(idx + 1).trim()
    if (propId && valId) out.push({ propId, valId })
  }
  return out
}

async function resolveExecutablePath(): Promise<string> {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  if (process.platform === "darwin") {
    const mac =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if (existsSync(mac)) return mac
  }
  return chromium.executablePath()
}

function isLikelySystemChrome(executablePath: string): boolean {
  return (
    executablePath.includes("Google Chrome") ||
    executablePath.includes("Chromium") ||
    executablePath.includes("microsoft-edge")
  )
}

type AePropVal = {
  type: string
  name: string
  image: string
}

function resolvePropValue(
  skuPropList: Record<string, unknown>[],
  propId: string,
  valId: string
): AePropVal | null {
  const prop = skuPropList.find(
    (p) => String(p.skuPropertyId ?? p.skuPropertyIdLong ?? "") === propId
  )
  if (!prop) return null
  const type =
    typeof prop.skuPropertyName === "string"
      ? prop.skuPropertyName.trim()
      : ""
  const vals = prop.skuPropertyValues
  if (!Array.isArray(vals)) return null
  const val = vals.find(
    (x) =>
      x &&
      typeof x === "object" &&
      String((x as Record<string, unknown>).propertyValueId ?? "") === valId
  ) as Record<string, unknown> | undefined
  if (!val) return null
  const nameRaw =
    (typeof val.propertyValueDisplayName === "string"
      ? val.propertyValueDisplayName
      : "") ||
    (typeof val.propertyValueDefinitionName === "string"
      ? val.propertyValueDefinitionName
      : "")
  const name = nameRaw.trim()
  if (!name) return null
  let image = ""
  if (typeof val.skuPropertyImagePath === "string") {
    image = val.skuPropertyImagePath.trim()
    if (image && !/^https?:/i.test(image)) image = `https:${image}`
  }
  return { type: type || "Option", name, image }
}

function buildFromAeState(
  productData: Record<string, unknown>,
  sourceUrl: string
) {
  const data = asRec(productData.data) ?? {}
  const root = asRec(data.root)
  const fieldsFromRoot =
    root?.fields &&
    typeof root.fields === "object" &&
    !Array.isArray(root.fields)
      ? (root.fields as Record<string, unknown>)
      : null
  const fields =
    fieldsFromRoot ?? asRec(data.productInfoComponent) ?? {}

  const skuModule = asRec(data.skuModule) ?? {}
  const skuPriceList = Array.isArray(skuModule.skuPriceList)
    ? (skuModule.skuPriceList as Record<string, unknown>[])
    : []
  const skuPropList = Array.isArray(skuModule.productSKUPropertyList)
    ? (skuModule.productSKUPropertyList as Record<string, unknown>[])
    : Array.isArray(fields.skuPropertyList)
      ? (fields.skuPropertyList as Record<string, unknown>[])
      : []

  const pidRaw = fields.productId
  const productIdStr =
    typeof pidRaw === "number"
      ? String(pidRaw)
      : typeof pidRaw === "string"
        ? pidRaw.trim()
        : ""

  const subject =
    typeof fields.subject === "string"
      ? fields.subject.trim()
      : typeof fields.title === "string"
        ? fields.title.trim()
        : ""

  const descA =
    typeof fields.description === "string" ? fields.description.trim() : ""
  const descB =
    typeof fields.productDesc === "string" ? fields.productDesc.trim() : ""
  const description =
    [descA, descB].filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? ""

  const priceRoot = asRec(fields.price)
  const rootList = num(priceRoot?.maxAmount && asRec(priceRoot.maxAmount)?.value)

  const variants: Array<{
    name: string
    image: string
    price: number
    stock: number
    type?: string
    sku?: string
    attributes?: Record<string, string>
  }> = []

  const colors: Array<{ name: string; hex: string; image: string }> = []
  const sizes: string[] = []
  const sizes_objects: Array<{ name: string; value: string }> = []
  const seenColor = new Set<string>()
  const seenSize = new Set<string>()

  let price = 0
  let original_price = 0

  if (skuPriceList.length > 0) {
    const allPrices = skuPriceList
      .map((s) => {
        const sv = asRec(s.skuVal)
        const act = asRec(sv?.skuActivityAmount)
        const amt = asRec(sv?.skuAmount)
        return num(act?.value) || num(amt?.value)
      })
      .filter((p) => p > 0)
    if (allPrices.length > 0) {
      price = Math.min(...allPrices)
      original_price = Math.max(...allPrices)
    }
    if (rootList > 0) original_price = Math.max(original_price, rootList)

    for (const sku of skuPriceList) {
      const skuIdRaw = sku.skuPropIds
      const skuId =
        typeof skuIdRaw === "number"
          ? String(skuIdRaw)
          : typeof skuIdRaw === "string"
            ? skuIdRaw.trim()
            : ""
      const sv = asRec(sku.skuVal)
      const act = asRec(sv?.skuActivityAmount)
      const amt = asRec(sv?.skuAmount)
      const linePrice = num(act?.value) || num(amt?.value) || price
      const aq = sv?.availQuantity
      const stock =
        typeof aq === "number" && Number.isFinite(aq)
          ? Math.max(0, Math.round(aq))
          : parseInt(String(aq ?? ""), 10)
      const stockN = Number.isFinite(stock) && stock >= 0 ? stock : 50

      const pairs = parseSkuPropPairs(skuId)
      const props: AePropVal[] = []
      for (const { propId, valId } of pairs) {
        const hit = resolvePropValue(skuPropList, propId, valId)
        if (hit) props.push(hit)
      }

      const name =
        props.length > 0
          ? props.map((p) => p.name).join(" - ")
          : skuId || "Variant"
      const attributes: Record<string, string> = {}
      for (const p of props) {
        if (p.type) attributes[p.type] = p.name
      }
      const image = props.find((p) => p.image)?.image ?? ""
      const type = props.map((p) => p.type).join(" / ").slice(0, 200)

      variants.push({
        name: name.slice(0, 240),
        attributes: Object.keys(attributes).length ? attributes : undefined,
        image,
        price: linePrice,
        stock: stockN,
        type: type || undefined,
        sku: productIdStr
          ? `AE-${productIdStr}-${skuId.replace(/[:;,#+]+/g, "-")}`.slice(0, 120)
          : skuId.replace(/[:;,#+]+/g, "-").slice(0, 120),
      })

      for (const p of props) {
        const tl = p.type.toLowerCase()
        if (
          tl.includes("color") ||
          tl.includes("colour") ||
          tl.includes("couleur")
        ) {
          if (!seenColor.has(p.name)) {
            seenColor.add(p.name)
            colors.push({
              name: p.name.slice(0, 120),
              hex: "#CCCCCC",
              image: p.image,
            })
          }
        }
        if (
          tl.includes("size") ||
          tl.includes("length") ||
          tl.includes("taille")
        ) {
          if (!seenSize.has(p.name)) {
            seenSize.add(p.name)
            sizes_objects.push({
              name: p.name.slice(0, 160),
              value: p.name.slice(0, 160),
            })
            sizes.push(p.name)
          }
        }
      }
    }
  }

  if (!(price > 0) && priceRoot) {
    const act = asRec(priceRoot.minActivityAmount)
    const sale = asRec(priceRoot.salePrice)
    const mn = asRec(priceRoot.minAmount)
    price =
      num(act?.value) || num(sale?.value) || num(mn?.value) || rootList || 0
    original_price =
      rootList > 0 ? Math.max(rootList, price) : price > 0 ? price : 0
  }

  const imgSrc = fields.imagePathList ?? fields.images
  const imagesRaw = Array.isArray(imgSrc)
    ? imgSrc.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : []
  const images = imagesRaw
    .map((img) => {
      let x = img.trim()
      if (!/^https?:/i.test(x)) x = `https:${x}`
      return x.replace(/_\d+x\d+\./, "_960x960.")
    })
    .slice(0, 10)

  const qty = asRec(fields.quantity)
  let stockTotal = 999
  const t1 = qty?.totalAvailable ?? qty?.total_avail_quantity
  const t2 = fields.totalAvailQuantity
  const parseStock = (v: unknown) => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10)
    return Number.isFinite(n) && n > 0
      ? Math.min(Math.max(Math.round(n), 1), 999_999)
      : 0
  }
  const s1 = parseStock(t1)
  const s2 = parseStock(t2)
  if (s1) stockTotal = s1
  else if (s2) stockTotal = s2

  if (variants.length === 0) {
    variants.push({
      name: "Default",
      type: "Default",
      image: images[0] ?? "",
      price: price > 0 ? price : 0,
      stock: stockTotal,
      sku: productIdStr ? `AE-${productIdStr}` : "",
    })
  }

  const shipping = {
    from_country: "China",
    delivery_time: "15–25 days",
    shipping_cost: 0,
    processing_time: "1–3 days",
    carrier: "Colissimo",
  }

  const del = asRec(fields.delivery)
  if (del) {
    const w =
      typeof del.warehouseCountry === "string"
        ? del.warehouseCountry.trim()
        : ""
    const shipFrom =
      typeof del.shipFrom === "string" ? del.shipFrom.trim() : ""
    shipping.from_country = w || shipFrom || shipping.from_country
    const ed =
      typeof del.estimatedDeliveryTime === "string"
        ? del.estimatedDeliveryTime.trim()
        : ""
    const dd =
      typeof del.deliveryTimeDesc === "string"
        ? del.deliveryTimeDesc.trim()
        : ""
    shipping.delivery_time = ed || dd || shipping.delivery_time
    const pt =
      typeof del.processingTime === "string"
        ? del.processingTime.trim()
        : ""
    if (pt) shipping.processing_time = pt
    const comp =
      typeof del.shippingCompany === "string"
        ? del.shippingCompany.trim()
        : ""
    if (comp) shipping.carrier = comp
    const fee = del.shippingFee
    if (fee != null) {
      const fn = typeof fee === "number" ? fee : num(fee)
      if (fn > 0) shipping.shipping_cost = fn
    }
  }
  const freight = asRec(fields.freightAmount)
  if (freight?.value != null) {
    const fn = num(freight.value)
    if (fn > 0)
      shipping.shipping_cost = Math.max(shipping.shipping_cost, fn)
  }

  const specs: Record<string, string> = {}
  const propList = fields.productPropList
  if (Array.isArray(propList)) {
    for (const raw of propList) {
      const row = asRec(raw)
      if (!row) continue
      const k =
        typeof row.attrName === "string"
          ? row.attrName.trim()
          : typeof row.name === "string"
            ? row.name.trim()
            : ""
      if (!k) continue
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
      if (v) specs[k.slice(0, 200)] = v.slice(0, 1200)
    }
  }

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let reviewTotal = 0
  let average_rating = 0
  const reviewItems: Array<{
    rating: number
    author: string
    country: string
    date: string
    text: string
    images: string[]
    variant: string
    helpful_count: number
    verified: boolean
  }> = []

  const evo = asRec(fields.evo)?.review ?? fields.feedback
  const revBlock = evo && typeof evo === "object" && !Array.isArray(evo)
    ? (evo as Record<string, unknown>)
    : null

  if (revBlock) {
    const totalNum =
      revBlock.totalValidNum ?? revBlock.totalNum ?? revBlock.total
    const tn =
      typeof totalNum === "number"
        ? totalNum
        : parseInt(String(totalNum ?? ""), 10)
    if (Number.isFinite(tn) && tn >= 0) reviewTotal = tn
    const avgRaw =
      revBlock.averageStar ??
      revBlock.averageStarRating ??
      revBlock.ratingValue
    const av =
      typeof avgRaw === "number"
        ? avgRaw
        : parseFloat(String(avgRaw ?? ""))
    if (Number.isFinite(av) && av > 0) average_rating = av
    const sl = asRec(revBlock.starLevel)
    if (sl) {
      breakdown[5] =
        typeof sl.fiveStarNum === "number" ? sl.fiveStarNum : num(sl["5"]) || 0
      breakdown[4] =
        typeof sl.fourStarNum === "number" ? sl.fourStarNum : num(sl["4"]) || 0
      breakdown[3] =
        typeof sl.threeStarNum === "number" ? sl.threeStarNum : num(sl["3"]) || 0
      breakdown[2] =
        typeof sl.twoStarNum === "number" ? sl.twoStarNum : num(sl["2"]) || 0
      breakdown[1] =
        typeof sl.oneStarNum === "number" ? sl.oneStarNum : num(sl["1"]) || 0
    }
    const list = revBlock.reviewList
    if (Array.isArray(list)) {
      for (const raw of list.slice(0, 20)) {
        const r = asRec(raw)
        if (!r) continue
        const ratingRaw = r.star ?? r.rating
        const rating =
          typeof ratingRaw === "number"
            ? ratingRaw
            : parseInt(String(ratingRaw ?? 5), 10) || 5
        const author =
          typeof r.buyerName === "string" ? r.buyerName.trim() : "Anonymous"
        const country =
          typeof r.buyerCountry === "string" ? r.buyerCountry.trim() : ""
        const date =
          typeof r.reviewDate === "string"
            ? r.reviewDate.trim()
            : typeof r.gmtCreate === "string"
              ? r.gmtCreate.trim()
              : ""
        const text =
          typeof r.reviewContent === "string"
            ? r.reviewContent.trim()
            : typeof r.buyerFeedback === "string"
              ? r.buyerFeedback.trim()
              : ""
        const variant =
          typeof r.skuInfo === "string" ? r.skuInfo.trim() : ""
        const helpful =
          r.thumbUpNum != null
            ? typeof r.thumbUpNum === "number"
              ? r.thumbUpNum
              : parseInt(String(r.thumbUpNum), 10) || 0
            : 0
        const imgsRaw = r.images
        const imagesRev: string[] = []
        if (Array.isArray(imgsRaw)) {
          for (const im of imgsRaw) {
            if (typeof im !== "string" || !im.trim()) continue
            let u = im.trim()
            if (!/^https?:/i.test(u)) u = `https:${u}`
            imagesRev.push(u.slice(0, 2000))
          }
        }
        reviewItems.push({
          rating: Math.min(5, Math.max(1, Math.round(rating))),
          author: author.slice(0, 120),
          country: country.slice(0, 80),
          date: date.slice(0, 80),
          text: text.slice(0, 4000),
          images: imagesRev.slice(0, 8),
          variant: variant.slice(0, 200),
          helpful_count: helpful,
          verified: true,
        })
      }
    }
  }

  const category =
    typeof fields.categoryName === "string" ? fields.categoryName.trim() : ""

  let currency = "EUR"
  const cur = priceRoot?.currency ?? fields.currency
  if (typeof cur === "string" && /^[A-Z]{3}$/i.test(cur.trim()))
    currency = cur.trim().toUpperCase()

  const suggested_price = parseFloat((price * IMPORT_MARKUP).toFixed(2))
  const profit_per_sale = (suggested_price - price).toFixed(2)

  const leadImage = images[0] ?? ""

  return {
    title: subject.slice(0, 200),
    description: description.slice(0, 5000),
    price,
    original_price: original_price > 0 ? original_price : price,
    currency,
    images,
    image: leadImage,
    variants,
    variants_count: Math.max(variants.length, 1),
    colors,
    sizes: uniqStrings(sizes, 120),
    sizes_objects,
    sku: productIdStr ? `AE-${productIdStr}` : "",
    stock: stockTotal,
    shipping,
    reviews: {
      total: reviewTotal,
      average_rating,
      breakdown,
      items: reviewItems,
    },
    specs,
    category: category.slice(0, 200),
    source_url: sourceUrl,
    suggested_price,
    suggested_commission: IMPORT_COMMISSION_HINT,
    profit_per_sale,
    basePrice: suggested_price,
    costPrice: price,
    extracted_fields: {
      title: Boolean(subject.trim()),
      price: price > 0,
      images: images.length,
      variants: variants.length,
      colors: colors.length,
      sizes: sizes.length + sizes_objects.length,
      reviews: reviewTotal,
      shipping: Boolean((shipping.delivery_time ?? "").trim().length > 0),
      specs_count: Object.keys(specs).length,
      carrier: Boolean((shipping.carrier ?? "").trim().length > 0),
    },
    debug: {
      variants_found: variants.length,
      images_found: images.length,
      price_found: price,
      reviews_found: reviewTotal,
    },
  }
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

  if (!/aliexpress\./i.test(parsedUrl.hostname)) {
    return NextResponse.json(
      {
        error: "URL import supports AliExpress only",
        suggestion: "Use an aliexpress.com product link or CSV import.",
      },
      { status: 400 }
    )
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

  try {
    const executablePath = await resolveExecutablePath()
    const systemChrome = isLikelySystemChrome(executablePath)

    browser = await puppeteer.launch({
      executablePath,
      headless: systemChrome ? true : "shell",
      args: systemChrome
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        : puppeteer.defaultArgs({
            args: chromium.args,
            headless: "shell",
          }),
      defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
    })

    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    await page.setExtraHTTPHeaders({
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    })

    await page.goto(parsedUrl.href, {
      waitUntil: "networkidle2",
      timeout: 45_000,
    })

    await new Promise((r) => setTimeout(r, 3000))

    const productData = await page.evaluate(() => {
      const w = window as unknown as {
        __AER_DATA__?: unknown
        runParams?: unknown
      }
      if (w.__AER_DATA__ != null) return w.__AER_DATA__
      if (w.runParams != null) return w.runParams
      return null
    })

    await browser.close()
    browser = null

    const rec = asRec(productData)
    if (!rec) {
      return NextResponse.json(
        {
          error: "Could not extract product data",
          details: "AliExpress did not expose __AER_DATA__ or runParams",
          suggestion:
            "Try again, another item, or CSV import. The page may have blocked automation.",
        },
        { status: 422 }
      )
    }

    const row = buildFromAeState(rec, url)

    if (!row.title.trim()) {
      return NextResponse.json(
        {
          error: "Could not extract product data",
          details: "Missing product title",
          suggestion: "Try CSV import or another URL.",
        },
        { status: 422 }
      )
    }

    const { extracted_fields, debug, ...productBody } = row

    return NextResponse.json({
      success: true,
      products: [
        {
          ...productBody,
          selected: true as const,
        },
      ],
      precision: "high",
      extraction_method: "puppeteer-aliexpress",
      extracted_fields,
      debug,
    })
  } catch (error) {
    if (browser) {
      try {
        await browser.close()
      } catch {
        /* ignore */
      }
    }
    console.error("Import error:", error)
    return NextResponse.json(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : "Unknown error",
        suggestion:
          "AliExpress may be blocking automation. Set PUPPETEER_EXECUTABLE_PATH to Chrome on macOS, or try CSV import.",
      },
      { status: 500 }
    )
  }
}
