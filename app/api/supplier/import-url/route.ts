import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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

/** Balanced `{...}` slice after regex match (runParams / __AER_DATA__). */
function extractBalancedJson(
  html: string,
  keyRe: RegExp
): Record<string, unknown> | null {
  const m = keyRe.exec(html)
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
          return JSON.parse(html.slice(startBrace, i + 1)) as Record<
            string,
            unknown
          >
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function extractPageStatePayload(html: string): Record<string, unknown> | null {
  const runParams =
    extractBalancedJson(html, /window\.runParams\s*=/) ??
    extractBalancedJson(html, /window\[["']runParams["']\]\s*=/)

  const aer =
    extractBalancedJson(html, /window\.__AER_DATA__\s*=/) ??
    extractBalancedJson(html, /window\[["']__AER_DATA__["']\]\s*=/)

  for (const obj of [aer, runParams]) {
    if (!obj) continue
    const inner = asRec(obj.data)
    if (inner && (inner.productInfoComponent || inner.skuModule || inner.root))
      return inner
    if (
      inner &&
      (typeof inner.subject === "string" ||
        asRec(inner.productInfo) ||
        inner.skuModule)
    )
      return inner
  }
  return null
}

/** Map mobile-ish JSON into the same `{ productInfoComponent, skuModule… }` shape. */
function mobileResponseToAeRoot(parsed: Record<string, unknown>): Record<
  string,
  unknown
> | null {
  const candidates: Array<Record<string, unknown> | null> = [
    asRec(parsed.result),
    asRec(asRec(parsed.data)?.result),
    asRec(parsed.ret),
    asRec(parsed.payload),
    asRec(parsed.response),
    asRec(parsed.detail),
    asRec(parsed.detailInfo),
    asRec(parsed.bizData),
    asRec(parsed.bizdata),
    asRec(parsed.DATA),
    asRec(asRec(parsed.ret)?.data),
  ].filter(Boolean) as Record<string, unknown>[]

  for (const raw of candidates) {
    const r = raw ?? {}
    const pi = asRec(r.productInfo)
    let component =
      pi ??
      (typeof r.subject === "string"
        ? (r as Record<string, unknown>)
        : null)

    const altPic = asRec(r.productInfoComponent)
    if (!component?.subject && !component?.title && altPic)
      component = altPic

    const hasSignal =
      (component && (typeof component.subject === "string" || typeof component.title === "string")) ||
      !!asRec(component)?.subject ||
      !!(component && typeof component === "object" && component !== null &&
        typeof (component as Record<string, unknown>).productId !== "undefined")

    if (
      component &&
      (hasSignal ||
        asRec(r.skuModule) ||
        (Array.isArray(r.skuPriceList) && r.skuPriceList.length > 0))
    )
      return {
        productInfoComponent: component ?? {},
        skuModule: asRec(r.skuModule) ?? {},
        priceModule:
          asRec(r.priceModule) ??
          asRec(asRec(component)?.priceModule ?? null) ??
          {},
        shippingModule:
          asRec(r.shippingModule) ??
          asRec(asRec(component)?.shippingModule ?? null) ??
          {},
        reviewModule:
          asRec(r.reviewModule) ??
          asRec(asRec(component)?.reviewModule ?? null) ??
          {},
      }
  }

  const data = asRec(parsed.data)
  if (
    data &&
    (data.productInfoComponent || data.root || data.skuModule)
  )
    return data

  return null
}

/** Core mapper: AE `data` root (desktop API or embedded page state). */
function buildPreviewFromAeRoot(
  inner: Record<string, unknown>,
  productId: string,
  sourceUrl: string,
  _skuFallbackHint: string | null
): {
  draft: Record<string, unknown>
  extracted_fields: Record<string, unknown>
  debug: Record<string, number>
} | null {
  const productInfo =
    asRec(inner.productInfoComponent) ??
    asRec(inner.productInfo) ??
    {}
  const rootFields = asRec(asRec(inner.root)?.fields ?? null)
  const mergedInfo =
    Object.keys(productInfo).length > 0
      ? { ...productInfo, ...rootFields }
      : { ...rootFields }

  const info = mergedInfo
  const skuModule = asRec(inner.skuModule) ?? {}
  const priceModule = asRec(inner.priceModule) ?? {}
  const shippingModule = asRec(inner.shippingModule) ?? {}
  const reviewModule = asRec(inner.reviewModule) ?? {}

  const title =
    typeof info.subject === "string"
      ? info.subject.trim()
      : typeof info.title === "string"
        ? info.title.trim()
        : ""

  if (!title) return null

  const descA =
    typeof info.description === "string" ? info.description.trim() : ""
  const descB =
    typeof info.productDesc === "string" ? info.productDesc.trim() : ""
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
    const mf = info.minAmount ?? info.discount ?? info.promotion_price
    if (!(price > 0)) price = num(mf)
  }
  if (rootList > 0) original_price = Math.max(original_price, rootList, price)
  else if (!(original_price > 0) && price > 0) original_price = price

  let currency = "EUR"
  const curRaw = minAct?.currency ?? priceModule.currency ?? info.currency
  if (typeof curRaw === "string" && /^[A-Z]{3}$/i.test(curRaw.trim()))
    currency = curRaw.trim().toUpperCase()

  const resolvedPid =
    (typeof info.productId === "number"
      ? String(info.productId)
      : typeof info.productId === "string"
        ? info.productId.trim()
        : "") || productId

  const imgSrc =
    info.imagePathList ??
    info.images ??
    info.imageList
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
  const plist = info.productPropList
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

  const skuMap = buildSkuPriceMap(skuPriceList, price > 0 ? price : 0)

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
        sku: `AE-${resolvedPid}-${skuSuffix}`.slice(0, 120),
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
    const tq = info.totalAvailQuantity
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
      sku: _skuFallbackHint ?? `AE-${resolvedPid}`,
    })
  }

  let stockTotal = 999
  const tq = info.totalAvailQuantity ?? info.totalAvailable
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

  const del = info.delivery ?? asRec(rootFields)?.delivery
  const delRec = asRec(del)
  if (delRec) {
    const w =
      typeof delRec.warehouseCountry === "string"
        ? delRec.warehouseCountry.trim()
        : ""
    const shipFrom =
      typeof delRec.shipFrom === "string" ? delRec.shipFrom.trim() : ""
    if (w || shipFrom)
      shipping.from_country = w || shipFrom || shipping.from_country
    const edt =
      typeof delRec.estimatedDeliveryTime === "string"
        ? delRec.estimatedDeliveryTime.trim()
        : ""
    const dtd =
      typeof delRec.deliveryTimeDesc === "string"
        ? delRec.deliveryTimeDesc.trim()
        : ""
    if (edt || dtd) shipping.delivery_time = edt || dtd
    const pt =
      typeof delRec.processingTime === "string"
        ? delRec.processingTime.trim()
        : ""
    if (pt) shipping.processing_time = pt
    const comp =
      typeof delRec.shippingCompany === "string"
        ? delRec.shippingCompany.trim()
        : ""
    if (comp) shipping.carrier = comp
  }

  const freight = asRec(info.freightAmount)
  if (freight?.value != null) {
    const fn = num(freight.value)
    if (fn > 0) shipping.shipping_cost = Math.max(shipping.shipping_cost, fn)
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

  const evo = asRec(info.evo)?.review ?? info.feedback
  const evoRec =
    evo && typeof evo === "object" && !Array.isArray(evo)
      ? (evo as Record<string, unknown>)
      : null
  if (evoRec && reviewTotal === 0) {
    const totalNum =
      evoRec.totalValidNum ?? evoRec.totalNum ?? evoRec.total
    const tn =
      typeof totalNum === "number"
        ? totalNum
        : parseInt(String(totalNum ?? ""), 10)
    if (Number.isFinite(tn) && tn >= 0) reviewTotal = tn
    const avgRaw =
      evoRec.averageStar ??
      evoRec.averageStarRating ??
      evoRec.ratingValue
    const av =
      typeof avgRaw === "number"
        ? avgRaw
        : parseFloat(String(avgRaw ?? ""))
    if (Number.isFinite(av) && av > 0) average_rating = av
  }

  const category =
    typeof info.categoryName === "string"
      ? info.categoryName.trim().slice(0, 200)
      : ""

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

  const draft: Record<string, unknown> = {
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
    sku: `AE-${resolvedPid}`,
    source_url: sourceUrl,
    category,
    suggested_price,
    suggested_commission: IMPORT_COMMISSION_HINT,
    profit_per_sale,
    basePrice: suggested_price,
    costPrice: price,
    selected: true as const,
  }

  return { draft, extracted_fields, debug }
}

function parseHtmlRegex(
  html: string,
  productId: string,
  sourceUrl: string
): {
  draft: Record<string, unknown>
  extracted_fields: Record<string, unknown>
  debug: Record<string, number>
} {
  const rawTitle =
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? ""
  const title = rawTitle.replace(/\s*\|\s*AliExpress.*$/i, "").trim()

  const priceMatch = html.match(
    /"minActivityAmount"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/i
  )
  const price =
    priceMatch?.[1] != null ? parseFloat(priceMatch[1]) || 0 : 0

  const images: string[] = []
  for (const match of html.matchAll(/"imagePathList"\s*:\s*\[([^\]]+)\]/gi)) {
    try {
      const parsed = JSON.parse(`[${match[1]}]`) as unknown
      if (Array.isArray(parsed)) {
        for (const u of parsed) {
          if (typeof u !== "string" || !u.trim()) continue
          let x = u.trim()
          if (!/^https?:/i.test(x)) x = `https:${x}`
          images.push(x.replace(/_\d+x\d+\./, "_960x960."))
        }
      }
    } catch {
      /* ignore */
    }
  }

  const uniq = uniqStrings(images, 12).slice(0, 10)
  const lead = uniq[0] ?? ""
  const stock = 999
  const priceNum = price

  const suggested_price = parseFloat((priceNum * IMPORT_MARKUP).toFixed(2))
  const profit_per_sale = (suggested_price - priceNum).toFixed(2)

  const draft: Record<string, unknown> = {
    title: title.slice(0, 200) || `Product ${productId}`,
    description: "",
    price: parseFloat(priceNum.toFixed(4)),
    original_price: parseFloat(priceNum.toFixed(4)),
    currency: "EUR",
    images: uniq,
    image: lead,
    variants: [
      {
        name: "Default",
        type: "Default",
        image: lead,
        price: priceNum,
        stock,
        sku: `AE-${productId}`,
      },
    ],
    variants_count: 1,
    colors: [] as Array<{ name: string; hex: string; image: string }>,
    sizes: [] as string[],
    sizes_objects: [] as Array<{ name: string; value: string }>,
    shipping: {
      from_country: "China",
      delivery_time: "15–25 days",
      shipping_cost: 0,
      processing_time: "1–3 days",
      carrier: "Colissimo",
    },
    specs: {} as Record<string, string>,
    reviews: {
      total: 0,
      average_rating: 0,
      breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      items: [] as unknown[],
    },
    stock,
    sku: `AE-${productId}`,
    source_url: sourceUrl,
    category: "",
    suggested_price,
    suggested_commission: IMPORT_COMMISSION_HINT,
    profit_per_sale,
    basePrice: suggested_price,
    costPrice: priceNum,
    selected: true as const,
  }

  const extracted_fields = {
    title: Boolean((draft.title as string).trim()),
    price: priceNum > 0,
    images: uniq.length,
    variants: 1,
    colors: 0,
    sizes: 0,
    reviews: 0,
    shipping: true,
    specs_count: 0,
    carrier: true,
  }

  const debug = {
    variants: 1,
    images: uniq.length,
    price: priceNum,
    reviews: 0,
  }

  return { draft, extracted_fields, debug }
}

function rewriteTitleForSEO(title: string): string {
  return title
    .replace(/AliExpress|Hot Sale|New Arrival|2026/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function detectCategory(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase()
  if (text.includes("car") || text.includes("auto")) return "Automotive"
  if (text.includes("phone") || text.includes("cable")) return "Electronics"
  if (text.includes("dress") || text.includes("shirt")) return "Fashion"
  return "General"
}

function generateTags(title: string, category: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5)
  return uniqStrings([category, ...words], 12)
}

async function checkDuplicate(supplierId: string, title: string): Promise<boolean> {
  const t = title.trim()
  if (t.length < 3) return false
  const found = await prisma.product.findFirst({
    where: {
      supplierId,
      name: { equals: t, mode: "insensitive" },
    },
    select: { id: true },
  })
  return Boolean(found)
}

function isDraftMissing(d: Record<string, unknown> | null): boolean {
  if (!d) return true
  const ttl = typeof d.title === "string" ? d.title.trim() : ""
  return ttl.length === 0
}

async function applyEnrichment(
  supplierId: string,
  draft: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const title = typeof draft.title === "string" ? draft.title : ""
  const description =
    typeof draft.description === "string" ? draft.description : ""
  const price = num(draft.price)
  const suggested = num(draft.suggested_price)
  const profitRaw =
    typeof draft.profit_per_sale === "string"
      ? parseFloat(draft.profit_per_sale)
      : suggested - price
  const profit = Number.isFinite(profitRaw) ? profitRaw : Math.max(suggested - price, 0)

  const title_ai = rewriteTitleForSEO(title)
  const category_ai = detectCategory(title, description)
  const tags = generateTags(title, category_ai)
  const is_duplicate = await checkDuplicate(supplierId, title)
  const roi =
    price > 0 ? Math.round((profit / price) * 100).toString() : "0"

  return {
    ...draft,
    title_ai,
    category_ai,
    tags,
    is_duplicate,
    roi,
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supplierId = session.user.id

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
      { error: "Invalid AliExpress URL" },
      { status: 400 }
    )
  }

  let extractionMethod = ""
  let draft: Record<string, unknown> | null = null
  let extracted_fields: Record<string, unknown> = {}
  let debug: Record<string, number> = {
    variants: 0,
    images: 0,
    price: 0,
    reviews: 0,
  }

  const fetchTimeout = () => AbortSignal.timeout(25_000)

  // METHOD 1: mobile API
  try {
    const mobileApi =
      `https://m.aliexpress.com/api/products/detail` +
      `?productId=${encodeURIComponent(productId)}` +
      `&lang=fr&country=FR&currency=EUR`
    const res = await fetch(mobileApi, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        Accept: "application/json",
      },
      signal: fetchTimeout(),
    })
    if (res.ok) {
      const parsed = (await res.json()) as Record<string, unknown>
      const inner = mobileResponseToAeRoot(parsed)
      if (inner) {
        const built = buildPreviewFromAeRoot(
          inner,
          productId,
          parsedUrl.href,
          null
        )
        if (built) {
          extractionMethod = "aliexpress-mobile-api"
          draft = built.draft
          extracted_fields = built.extracted_fields
          debug = built.debug
        }
      }
    }
  } catch {
    console.log("AliExpress mobile API fallback")
  }

  // METHOD 2: desktop API + headers
  if (isDraftMissing(draft)) {
    try {
      const pcApi =
        `https://www.aliexpress.com/aeglodetailweb/api/store/product/query` +
        `?productId=${encodeURIComponent(productId)}` +
        `&language=fr_FR&currency=EUR`
      const res = await fetch(pcApi, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          Referer: parsedUrl.href,
          Origin: "https://www.aliexpress.com",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "cors",
        },
        signal: fetchTimeout(),
      })

      if (res.ok) {
        const parsed = (await res.json()) as Record<string, unknown>
        const root = asRec(parsed.data)
        if (root) {
          const built = buildPreviewFromAeRoot(
            root,
            productId,
            parsedUrl.href,
            null
          )
          if (built) {
            extractionMethod = "aliexpress-pc-api"
            draft = built.draft
            extracted_fields = built.extracted_fields
            debug = built.debug
          }
        }
      }
    } catch {
      console.log("AliExpress PC API fallback")
    }
  }

  // METHOD 3: HTML → embedded JSON (runParams / __AER_DATA__) → regex
  let htmlMethod: "html-embedded-json" | "html-regex" | "" = ""

  if (isDraftMissing(draft)) {
    try {
      const res = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
        redirect: "follow",
        signal: fetchTimeout(),
      })
      if (res.ok) {
        const html = await res.text()
        const inner = extractPageStatePayload(html)

        const builtEmbedded =
          inner != null && Object.keys(inner).length > 0
            ? buildPreviewFromAeRoot(inner, productId, parsedUrl.href, null)
            : null

        if (builtEmbedded) {
          htmlMethod = "html-embedded-json"
          extractionMethod = "html-embedded-json"
          draft = builtEmbedded.draft
          extracted_fields = builtEmbedded.extracted_fields
          debug = builtEmbedded.debug
        } else {
          const rex = parseHtmlRegex(html, productId, parsedUrl.href)
          htmlMethod = "html-regex"
          extractionMethod = "html-regex"
          draft = rex.draft
          extracted_fields = rex.extracted_fields
          debug = rex.debug
        }
      }
    } catch {
      console.log("AliExpress HTML scrape fallback failed")
    }
  }

  if (isDraftMissing(draft)) {
    return NextResponse.json(
      {
        error: "AliExpress API request failed",
        details: "All extraction methods failed.",
        suggestion:
          "AliExpress may be blocking requests. Retry later or use CSV import.",
      },
      { status: 422 }
    )
  }

  const enriched = await applyEnrichment(supplierId, draft!)

  const precision =
    extractionMethod.includes("regex") ||
    extractionMethod === "html-regex" ||
    htmlMethod === "html-regex"
      ? "medium"
      : "high"

  return NextResponse.json({
    success: true,
    products: [enriched],
    extraction_method:
      extractionMethod || htmlMethod || "aliexpress-unknown",
    precision,
    extracted_fields,
    debug,
  })
}
