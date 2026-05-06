import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

/** AliExpress `skuPropIds` → several normalized keys for map lookup */
function skuPropIdsLookupKeys(raw: unknown): string[] {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim()
  if (!s) return []
  const segments = s
    .split(/[,;#+]+/)
    .map((x) => x.trim().replace(/^#/, ""))
    .filter((x) => x.length > 0 && x.includes(":"))
  if (segments.length === 0) return [s]
  const sortedSemi = [...segments].sort().join(";")
  const sortedComma = [...segments].sort().join(",")
  const joinSemi = segments.join(";")
  return uniqStrings([s, sortedSemi, sortedComma, joinSemi], 24)
}

type AeComboPiece = {
  name: string
  type: string
  image: string
  propId: string | number
  propNameId: string | number
}

function aeSkuScalarId(raw: unknown): string | number {
  if (raw == null) return ""
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") return raw.trim()
  return ""
}

function comboToSkuLookupKeys(combo: AeComboPiece[]): string[] {
  const parts = combo.map(
    (v) => `${String(v.propNameId).trim()}:${String(v.propId).trim()}`
  )
  return uniqStrings(
    [
      [...parts].sort().join(";"),
      [...parts].sort().join(","),
      parts.join(";"),
      parts.join(","),
    ],
    16
  )
}

function buildSkuPriceMap(
  skuPriceList: Record<string, unknown>[],
  fallbackPrice: number
): Map<string, { price: number; stock: number }> {
  const skuMap = new Map<string, { price: number; stock: number }>()
  for (const sku of skuPriceList) {
    const skuVal = asRec(sku.skuVal)
    const act = asRec(skuVal?.skuActivityAmount)
    const amt = asRec(skuVal?.skuAmount)
    const price =
      num(act?.value) || num(amt?.value) || fallbackPrice
    const aq = skuVal?.availQuantity
    const parsed =
      typeof aq === "number"
        ? aq
        : parseInt(String(aq ?? ""), 10)
    const stockN =
      Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 50

    const row = {
      price: price > 0 ? price : fallbackPrice,
      stock: stockN,
    }
    for (const k of skuPropIdsLookupKeys(sku.skuPropIds)) {
      if (k) skuMap.set(k, row)
    }
  }
  return skuMap
}

function cartesianAeCombos(
  propValues: AeComboPiece[][]
): AeComboPiece[][] {
  if (propValues.length === 0) return []
  if (propValues.some((a) => a.length === 0)) return []
  return propValues.reduce<AeComboPiece[][]>(
    (acc, curr) =>
      acc.length === 0
        ? curr.map((v) => [v])
        : acc.flatMap((a) => curr.map((b) => [...a, b])),
    []
  )
}

/** AliExpress item id from common URL shapes */
function extractAliExpressProductId(rawUrl: string): string | null {
  const u = rawUrl.trim()
  const patterns = [
    /\/item\/(?:\d+\.)?(\d+)\.html/i,
    /\/item\/(\d{6,})\.html/i,
    /\/i\/(\d{6,})\.html/i,
    /[?&]item_id=(\d+)/i,
    /[?&]productId=(\d+)/i,
  ]
  for (const rx of patterns) {
    const m = u.match(rx)
    if (m?.[1] && /^\d+$/.test(m[1])) return m[1]
  }
  return null
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
      { error: "Only AliExpress URLs are supported" },
      { status: 400 }
    )
  }

  const productId = extractAliExpressProductId(url)
  if (!productId) {
    return NextResponse.json(
      { error: "Invalid AliExpress URL (no product id)" },
      { status: 400 }
    )
  }

  const apiUrl =
    `https://www.aliexpress.com/aeglodetailweb/api/store/product/query` +
    `?productId=${encodeURIComponent(productId)}` +
    `&language=fr_FR&currency=EUR`

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: parsedUrl.href,
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "AliExpress API request failed",
          details: `HTTP ${response.status}`,
        },
        { status: 422 }
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    const root = asRec(data.data)
    if (!root) {
      return NextResponse.json(
        {
          error: "Unexpected API response",
          details: "Missing data root",
        },
        { status: 422 }
      )
    }

    const productInfo =
      asRec(root.productInfoComponent) ?? asRec(root.productInfo) ?? {}
    const skuModule = asRec(root.skuModule) ?? {}
    const priceModule = asRec(root.priceModule) ?? {}
    const shippingModule = asRec(root.shippingModule) ?? {}
    const reviewModule = asRec(root.reviewModule) ?? {}

    const title =
      typeof productInfo.subject === "string"
        ? productInfo.subject.trim()
        : typeof productInfo.title === "string"
          ? productInfo.title.trim()
          : ""

    const descA =
      typeof productInfo.description === "string"
        ? productInfo.description.trim()
        : ""
    const descB =
      typeof productInfo.productDesc === "string"
        ? productInfo.productDesc.trim()
        : ""
    const description =
      [descA, descB].filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? ""

    const skuPriceList = Array.isArray(skuModule.skuPriceList)
      ? (skuModule.skuPriceList as Record<string, unknown>[])
      : []

    const minAct = asRec(priceModule.minActivityAmount)
    const minAmt = asRec(priceModule.minAmount)
    const maxAmt = asRec(priceModule.maxAmount)

    let price = 0
    let original_price = 0

    if (skuPriceList.length > 0) {
      const prices = skuPriceList
        .map((s) => {
          const sv = asRec(s.skuVal)
          const act = asRec(sv?.skuActivityAmount)
          const amt = asRec(sv?.skuAmount)
          return num(act?.value) || num(amt?.value)
        })
        .filter((p) => p > 0)
      if (prices.length > 0) {
        price = Math.min(...prices)
        original_price = Math.max(...prices)
      }
    }

    const rootList = num(maxAmt?.value)
    if (!(price > 0)) {
      price = num(minAct?.value) || num(minAmt?.value)
    }
    if (rootList > 0) original_price = Math.max(original_price, rootList, price)
    else if (!(original_price > 0) && price > 0) original_price = price

    let currency = "EUR"
    const curRaw = minAct?.currency ?? priceModule.currency ?? productInfo.currency
    if (typeof curRaw === "string" && /^[A-Z]{3}$/i.test(curRaw.trim()))
      currency = curRaw.trim().toUpperCase()

    const imgSrc =
      productInfo.imagePathList ??
      productInfo.images ??
      productInfo.imageList
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

    const leadImage = images[0] ?? ""

    const specs: Record<string, string> = {}
    const plist = productInfo.productPropList
    if (Array.isArray(plist)) {
      for (const raw of plist) {
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

    const skuPropsRaw = skuModule.productSKUPropertyList
    const skuProps = Array.isArray(skuPropsRaw)
      ? skuPropsRaw.filter(
          (x): x is Record<string, unknown> =>
            Boolean(x) && typeof x === "object" && !Array.isArray(x)
        )
      : []

    const skuMap = buildSkuPriceMap(
      skuPriceList,
      price > 0 ? price : 0
    )

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

    if (skuProps.length > 0) {
      const propValues: AeComboPiece[][] = []

      for (const prop of skuProps) {
        const propName =
          typeof prop.skuPropertyName === "string"
            ? prop.skuPropertyName.trim()
            : ""
        const propNameId = aeSkuScalarId(
          prop.skuPropertyId ?? prop.skuPropertyIdLong ?? ""
        )
        const vals = prop.skuPropertyValues
        if (!Array.isArray(vals)) continue

        const rowVals: AeComboPiece[] = []
        for (const val of vals) {
          if (!val || typeof val !== "object" || Array.isArray(val)) continue
          const v = val as Record<string, unknown>
          const nameRaw =
            (typeof v.propertyValueDisplayName === "string"
              ? v.propertyValueDisplayName
              : "") ||
            (typeof v.propertyValueDefinitionName === "string"
              ? v.propertyValueDefinitionName
              : "")
          const displayName = nameRaw.trim()
          if (!displayName) continue
          const pid = aeSkuScalarId(
            v.propertyValueId ??
              v.variationId ??
              v.definitionId ??
              v.skuAttr ??
              ""
          )

          let vimg = ""
          if (typeof v.skuPropertyImagePath === "string") {
            vimg = v.skuPropertyImagePath.trim()
            if (vimg && !/^https?:/i.test(vimg)) vimg = `https:${vimg}`
          }

          rowVals.push({
            name: displayName.slice(0, 200),
            type: propName.slice(0, 120) || "Option",
            image: vimg,
            propId: pid,
            propNameId,
          })
        }
        if (rowVals.length > 0) propValues.push(rowVals)
      }

      const combinations = cartesianAeCombos(propValues)

      for (const combo of combinations) {
        let skuData: { price: number; stock: number } | undefined
        for (const k of comboToSkuLookupKeys(combo)) {
          const hit = skuMap.get(k)
          if (hit) {
            skuData = hit
            break
          }
        }
        if (!skuData)
          skuData = {
            price: price > 0 ? price : 0,
            stock: 50,
          }

        const variantName = combo.map((c) => c.name).join(" - ")
        const variantType = combo.map((c) => c.type).join(" / ")
        const variantImage =
          combo.find((c) => c.image.trim().length > 0)?.image ?? leadImage

        const skuSuffix =
          comboToSkuLookupKeys(combo)[0]?.replace(/[:;,#+]+/g, "-").slice(0, 100) ??
          ""

        const attributes: Record<string, string> = {}
        for (const c of combo) {
          if (c.type) attributes[c.type] = c.name
        }

        variants.push({
          name: variantName.slice(0, 240),
          type: variantType.slice(0, 200),
          image: variantImage,
          price: skuData.price,
          stock: skuData.stock,
          sku: `AE-${productId}-${skuSuffix}`.slice(0, 120),
          attributes:
            Object.keys(attributes).length > 0 ? attributes : undefined,
        })

        for (const c of combo) {
          const tl = c.type.toLowerCase()
          if (
            tl.includes("color") ||
            tl.includes("colour") ||
            tl.includes("couleur")
          ) {
            if (!seenColor.has(c.name)) {
              seenColor.add(c.name)
              colors.push({
                name: c.name.slice(0, 120),
                hex: "#CCCCCC",
                image: c.image,
              })
            }
          }
          if (
            tl.includes("size") ||
            tl.includes("length") ||
            tl.includes("taille")
          ) {
            if (!seenSize.has(c.name)) {
              seenSize.add(c.name)
              sizes_objects.push({
                name: c.name.slice(0, 160),
                value: c.name.slice(0, 160),
              })
              sizes.push(c.name)
            }
          }
        }
      }
    }

    if (variants.length === 0) {
      const tq = productInfo.totalAvailQuantity
      const st =
        typeof tq === "number"
          ? tq
          : parseInt(String(tq ?? ""), 10)
      const fallbackStock =
        Number.isFinite(st) && st > 0
          ? Math.min(Math.max(Math.round(st), 1), 999_999)
          : 999
      variants.push({
        name: "Default",
        type: "Default",
        image: leadImage,
        price: price > 0 ? price : 0,
        stock: fallbackStock,
        sku: `AE-${productId}`,
      })
    }

    let stockTotal = 999
    const tq = productInfo.totalAvailQuantity ?? productInfo.totalAvailable
    const stParse =
      typeof tq === "number"
        ? tq
        : parseInt(String(tq ?? ""), 10)
    if (Number.isFinite(stParse) && stParse > 0)
      stockTotal = Math.min(Math.max(Math.round(stParse), 1), 999_999)

    const shipping = {
      from_country: "China",
      delivery_time: "15–25 days",
      shipping_cost: 0,
      processing_time: "1–3 days",
      carrier: "Colissimo",
    }

    const gfi = asRec(shippingModule.generalFreightInfo)
    if (gfi) {
      const sf =
        typeof gfi.shipFrom === "string" ? gfi.shipFrom.trim() : ""
      const wc =
        typeof gfi.warehouseCountry === "string"
          ? gfi.warehouseCountry.trim()
          : ""
      shipping.from_country = sf || wc || shipping.from_country
      const dd =
        typeof gfi.deliveryTimeDesc === "string"
          ? gfi.deliveryTimeDesc.trim()
          : ""
      const ed =
        typeof gfi.estimatedDeliveryTime === "string"
          ? gfi.estimatedDeliveryTime.trim()
          : ""
      shipping.delivery_time = ed || dd || shipping.delivery_time
      const comp =
        typeof gfi.shippingCompany === "string"
          ? gfi.shippingCompany.trim()
          : ""
      if (comp) shipping.carrier = comp
      const fa = asRec(gfi.freightAmount)
      if (fa?.value != null) {
        const fn = num(fa.value)
        if (fn > 0) shipping.shipping_cost = fn
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

    if (Object.keys(reviewModule).length > 0) {
      const totalNum =
        reviewModule.totalValidNum ??
        reviewModule.totalNum ??
        reviewModule.total
      const tn =
        typeof totalNum === "number"
          ? totalNum
          : parseInt(String(totalNum ?? ""), 10)
      if (Number.isFinite(tn) && tn >= 0) reviewTotal = tn

      const avgRaw = reviewModule.averageStar ?? reviewModule.averageStarRating
      const av =
        typeof avgRaw === "number"
          ? avgRaw
          : parseFloat(String(avgRaw ?? ""))
      if (Number.isFinite(av) && av > 0) average_rating = av

      const sl = asRec(reviewModule.starLevel)
      if (sl) {
        breakdown[5] =
          typeof sl.fiveStarNum === "number" ? sl.fiveStarNum : num(sl["5"]) || 0
        breakdown[4] =
          typeof sl.fourStarNum === "number" ? sl.fourStarNum : num(sl["4"]) || 0
        breakdown[3] =
          typeof sl.threeStarNum === "number"
            ? sl.threeStarNum
            : num(sl["3"]) || 0
        breakdown[2] =
          typeof sl.twoStarNum === "number" ? sl.twoStarNum : num(sl["2"]) || 0
        breakdown[1] =
          typeof sl.oneStarNum === "number" ? sl.oneStarNum : num(sl["1"]) || 0
      }

      const list = reviewModule.reviewList
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
          const rimgs: string[] = []
          if (Array.isArray(imgsRaw)) {
            for (const im of imgsRaw) {
              if (typeof im !== "string" || !im.trim()) continue
              let u = im.trim()
              if (!/^https?:/i.test(u)) u = `https:${u}`
              rimgs.push(u.slice(0, 2000))
            }
          }
          reviewItems.push({
            rating: Math.min(5, Math.max(1, Math.round(rating))),
            author: author.slice(0, 120),
            country: country.slice(0, 80),
            date: date.slice(0, 80),
            text: text.slice(0, 4000),
            images: rimgs.slice(0, 8),
            variant: variant.slice(0, 200),
            helpful_count: helpful,
            verified: true,
          })
        }
      }
    }

    const category =
      typeof productInfo.categoryName === "string"
        ? productInfo.categoryName.trim().slice(0, 200)
        : ""

    if (!title) {
      return NextResponse.json(
        {
          error: "Could not extract product",
          details: "Empty title in API response",
        },
        { status: 422 }
      )
    }

    const suggested_price = parseFloat((price * IMPORT_MARKUP).toFixed(2))
    const profit_per_sale = (suggested_price - price).toFixed(2)

    const extracted_fields = {
      title: Boolean(title.trim()),
      price: price > 0,
      images: images.length,
      variants: variants.length,
      colors: colors.length,
      sizes: sizes.length + sizes_objects.length,
      reviews: reviewTotal,
      shipping: Boolean((shipping.delivery_time ?? "").trim().length > 0),
      specs_count: Object.keys(specs).length,
      carrier:
        typeof shipping.carrier === "string" &&
        (shipping.carrier ?? "").trim().length > 0,
    }

    const debug = {
      variants: variants.length,
      images: images.length,
      price,
      reviews: reviewTotal,
    }

    return NextResponse.json({
      success: true,
      products: [
        {
          title: title.slice(0, 200),
          description: description.slice(0, 5000),
          price: parseFloat(price.toFixed(4)),
          original_price: parseFloat(
            (original_price > 0 ? original_price : price).toFixed(4)
          ),
          currency,
          images,
          image: leadImage,
          variants,
          variants_count: Math.max(variants.length, 1),
          colors,
          sizes: uniqStrings(sizes, 120),
          sizes_objects: sizes_objects.slice(0, 40),
          shipping,
          specs,
          reviews: {
            total: reviewTotal,
            average_rating,
            breakdown,
            items: reviewItems,
          },
          stock: stockTotal,
          sku: `AE-${productId}`,
          source_url: url,
          category,
          suggested_price,
          suggested_commission: IMPORT_COMMISSION_HINT,
          profit_per_sale,
          basePrice: suggested_price,
          costPrice: price,
          selected: true as const,
        },
      ],
      precision: "high",
      extraction_method: "aliexpress-api",
      extracted_fields,
      debug,
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
