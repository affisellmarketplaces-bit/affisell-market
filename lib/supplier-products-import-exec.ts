import { Prisma } from "@prisma/client"

import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { scheduleProductAutoCategorization } from "@/lib/product-auto-categorize"
import {
  catalogHexForColorName,
  type ProductColorImageRow,
} from "@/lib/product-color-images"
import { type ProductVariantLine, newVariantRowId } from "@/lib/product-variants"
import { prisma } from "@/lib/prisma"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import {
  defaultAffiliateCommissionPct,
  normalizeAffiliateCommissionRatePct,
  parseListingKind,
} from "@/lib/supplier-commission"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"

export const SUPPLIER_IMPORT_MAX_BATCH = 30

const DEFAULT_MARKUP = 1.7
const DEFAULT_COMMISSION_HINT = 25

function variantSkuSlug(name: string, index: number, baseSku: string): string {
  const slug =
    name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .slice(0, 28) || `v${index}`
  return `${baseSku}-${slug}`.slice(0, 80)
}

function num(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const n = parseFloat(String(raw ?? "").replace(/\s+/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function parseHumanRangeInts(s: string): { lo: number; hi: number } | null {
  const t = s.replace(/–/g, "-").replace(/days?/gi, "").trim()
  const m = t.match(/(\d+)\s*-\s*(\d+)/)
  if (m) {
    const lo = parseInt(m[1], 10)
    const hi = parseInt(m[2], 10)
    if (Number.isFinite(lo) && Number.isFinite(hi)) return { lo, hi }
  }
  const one = s.match(/(\d+)/)
  if (one) {
    const n = parseInt(one[1], 10)
    return Number.isFinite(n) ? { lo: n, hi: n } : null
  }
  return null
}

function countryCodeGuess(label: string): string | undefined {
  const l = label.toLowerCase().trim()
  const map: Record<string, string> = {
    china: "CN",
    france: "FR",
    germany: "DE",
    spain: "ES",
    italy: "IT",
    usa: "US",
    uk: "GB",
    "united kingdom": "GB",
    "united states": "US",
  }
  for (const [word, cc] of Object.entries(map)) {
    if (l.includes(word)) return cc
  }
  if (/^[a-z]{2}$/i.test(label.trim())) return label.trim().toUpperCase()
  return undefined
}

function colorRowsFromImport(raw: unknown): ProductColorImageRow[] {
  if (!Array.isArray(raw)) return []
  const rows: ProductColorImageRow[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      const c = item.trim()
      if (c.length)
        rows.push({
          color: c.slice(0, 80),
          hex: catalogHexForColorName(c),
          image: "",
        })
      continue
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const nm = typeof o.name === "string" ? o.name.trim() : ""
    if (!nm.length) continue
    const hex =
      typeof o.hex === "string" && o.hex.trim()
        ? o.hex.trim().slice(0, 32)
        : catalogHexForColorName(nm)
    const img =
      typeof o.image === "string" ? o.image.trim().slice(0, 2000) : ""
    rows.push({
      color: nm.slice(0, 120),
      hex,
      image: img.startsWith("blob:") ? "" : img,
    })
    if (rows.length >= 40) break
  }
  return rows
}

function mergeImportTags(extra: unknown): string[] {
  const merged: string[] = []
  if (Array.isArray(extra)) {
    for (const x of extra) {
      if (typeof x === "string" && x.trim()) merged.push(x.trim())
    }
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of merged) {
    const s = t.length > 40 ? t.slice(0, 40) : t
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= 40) break
  }
  return out
}

export type SupplierProductsImportExecOk = {
  ok: true
  createdCount: number
  products: Array<{ id: string; name: string; sku: string }>
}

export type SupplierProductsImportExecErr = {
  ok: false
  error: string
  status: number
}

export async function executeSupplierProductsImport(args: {
  supplierId: string
  productsRaw: unknown[]
  bodyDraft: boolean
}): Promise<SupplierProductsImportExecOk | SupplierProductsImportExecErr> {
  const { supplierId, productsRaw, bodyDraft } = args

  if (!Array.isArray(productsRaw) || productsRaw.length === 0) {
    return { ok: false, error: "products array required", status: 400 }
  }

  if (productsRaw.length > SUPPLIER_IMPORT_MAX_BATCH) {
    return {
      ok: false,
      error: `At most ${SUPPLIER_IMPORT_MAX_BATCH} products per request`,
      status: 400,
    }
  }

  const supplierStore = await prisma.store.findUnique({
    where: { userId: supplierId },
    select: { id: true },
  })

  let createdCount = 0
  const createdProducts: Array<{ id: string; name: string; sku: string }> = []

  for (const raw of productsRaw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const p = raw as Record<string, unknown>

    const nameStr = typeof p.title === "string" ? p.title.trim() : ""
    if (!nameStr) continue

    const suggestedEur = num(p.suggested_price)
    const costEur = num(p.price)
    const priceEur =
      suggestedEur > 0 ? suggestedEur : costEur > 0 ? costEur * DEFAULT_MARKUP : 0

    const basePriceCents = Math.max(100, Math.round(priceEur * 100))

    const listingKind = parseListingKind(p.listing_kind ?? p.listingKind)
    const commRaw = num(p.suggested_commission)
    const commHint = commRaw > 0 ? commRaw : DEFAULT_COMMISSION_HINT
    const normalizedComm = normalizeAffiliateCommissionRatePct(
      commHint,
      listingKind
    )
    const commissionRate = normalizedComm.ok
      ? normalizedComm.rate
      : defaultAffiliateCommissionPct()

    const statusRaw =
      typeof p.status === "string" ? p.status.toLowerCase() : ""
    const asDraft =
      statusRaw === "draft" || p.active === false || bodyDraft
    const active = !asDraft

    const stockN = Math.max(
      0,
      Math.round(Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0)
    )

    const images = parseSupplierProductImages(p)

    const categoryStr =
      typeof p.category === "string" ? p.category.trim() : ""

    const shippingObj = p.shipping
    const shipGuess: Record<string, unknown> = {}

    let shipsFromText: string | null = null

    let deliveryMid: number | undefined
    let deliveryLo = 5
    let deliveryHi = 14

    if (
      shippingObj &&
      typeof shippingObj === "object" &&
      !Array.isArray(shippingObj)
    ) {
      const sh = shippingObj as Record<string, unknown>
      const from =
        typeof sh.from_country === "string"
          ? sh.from_country.trim()
          : ""

      if (from) shipsFromText = from.slice(0, 120)

      const cc = from ? countryCodeGuess(from) : undefined
      if (cc) shipGuess.shippingCountry = cc

      const shipCostNum = num(sh.shipping_cost)
      if (shipCostNum >= 0) shipGuess.shippingCostEUR = shipCostNum

      const dt =
        typeof sh.delivery_time === "string" ? sh.delivery_time : ""
      const dr = parseHumanRangeInts(dt)
      if (dr) {
        deliveryLo = dr.lo
        deliveryHi = dr.hi
        deliveryMid = Math.round((dr.lo + dr.hi) / 2)
      }
      shipGuess.deliveryMin = deliveryLo
      shipGuess.deliveryMax = deliveryHi

      const pt =
        typeof sh.processing_time === "string" ? sh.processing_time : ""
      const pr = parseHumanRangeInts(pt)
      shipGuess.processingTime = pr
        ? Math.max(1, Math.round((pr.lo + pr.hi) / 2))
        : 2

      const fl = from.toLowerCase()
      if (/china|hong kong|aliexpress/i.test(fl) || cc === "CN")
        shipGuess.warehouseType = "international"
      else if (/united states|usa\b|amazon\b/i.test(fl) || cc === "US")
        shipGuess.warehouseType = "international"
      else if (/warehouse|dropship/i.test(fl))
        shipGuess.warehouseType = "international"
      else if (fl.includes("shop /") || /^shop\b/i.test(fl))
        shipGuess.warehouseType = "international"
      else
        shipGuess.warehouseType =
          cc === "FR" || cc === undefined ? "local" : "regional"

      shipGuess.shippingMethods = ["standard"]
    }

    const ship = parseSupplierProductShippingBody(shipGuess)

    const colorRowsAll = colorRowsFromImport(p.colors).slice()
    const colorMap = new Map<string, ProductColorImageRow>()
    for (const r of colorRowsAll) {
      if (!colorMap.has(r.color)) colorMap.set(r.color, r)
    }
    const mergedColorRows = [...colorMap.values()].slice(0, 40)
    const colorNames =
      mergedColorRows.length > 0
        ? mergedColorRows.map((r) => r.color).slice(0, 24)
        : []

    let desc = typeof p.description === "string" ? p.description.trim() : ""
    const src =
      typeof p.source_url === "string" ? p.source_url.trim() : ""
    if (src)
      desc = desc ? `${desc}\n\nImported from ${src}` : `Imported from ${src}`

    const specs = p.specs
    if (specs && typeof specs === "object" && !Array.isArray(specs)) {
      const entries = Object.entries(specs as Record<string, unknown>).slice(
        0,
        80
      )
      if (entries.length) {
        desc += `\n\nSpecifications\n`
        for (const [k, v] of entries) desc += `- ${String(k)}: ${String(v)}\n`
      }
    }

    const sizesUnknown = p.sizes
    if (
      Array.isArray(sizesUnknown) &&
      sizesUnknown.some((x) => typeof x === "string")
    ) {
      const sl = sizesUnknown
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40)
      if (sl.length) desc += `\n\nSizes available: ${sl.join(", ")}`
    }

    if (costEur > 0 && !/Supplier cost reference/i.test(desc))
      desc += `\n\nSupplier cost reference: €${costEur.toFixed(2)}`

    if (!desc.trim()) desc = "—"

    const baseSku =
      typeof p.sku === "string" && p.sku.trim()
        ? p.sku.trim().slice(0, 80)
        : `imp-${Date.now().toString(36)}`

    const variantInputs = Array.isArray(p.variants) ? p.variants : []
    const variantRowsFiltered: ProductVariantLine[] = []

    const priceEuroForLines = suggestedEur > 0 ? suggestedEur : priceEur

    for (let index = 0; index < variantInputs.length; index++) {
      const v = variantInputs[index]
      if (!v || typeof v !== "object" || Array.isArray(v)) continue
      const row = v as Record<string, unknown>
      const vType =
        typeof row.type === "string" ? row.type.trim().slice(0, 120) : ""
      const nm =
        typeof row.name === "string" ? row.name.trim().slice(0, 160) : ""
      if (!nm.length) continue
      const labeled =
        vType && nm ? `${vType}: ${nm}`.slice(0, 200) : nm
      const vPrice = num(row.price)
      const lineEur =
        vPrice > 0 ? vPrice : priceEuroForLines > 0 ? priceEuroForLines : priceEur

      const vs = Number(row.stock)
      const vStock =
        Number.isFinite(vs) && vs >= 0 ? Math.round(vs) : stockN

      let lineSku = ""
      if (typeof row.sku === "string" && row.sku.trim())
        lineSku = row.sku.trim().slice(0, 80)
      else
        lineSku = variantSkuSlug(
          labeled.replace(/[:/\s]+/g, "-"),
          index,
          baseSku
        )

      const vimgRaw =
        typeof row.image === "string" ? row.image.trim().slice(0, 2000) : ""

      const line: ProductVariantLine = {
        id: newVariantRowId(),
        name: labeled,
        sku: lineSku,
        priceCents: Math.max(0, Math.round(lineEur * 100)),
        stock: Math.max(0, vStock),
        commission: commissionRate,
        sales: 0,
      }
      if (vimgRaw && !vimgRaw.startsWith("blob:")) line.image = vimgRaw
      variantRowsFiltered.push(line)
    }

    const sizesStr = Array.isArray(p.sizes)
      ? (p.sizes as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 40)
      : []

    const variantsPayload: Record<string, unknown> = {}
    if (variantRowsFiltered.length > 0)
      variantsPayload.variantRows = variantRowsFiltered.slice(0, 500)
    if (sizesStr.length > 0) variantsPayload.size = sizesStr

    const tagsForAttr = mergeImportTags(p.tags)

    const attrBody: Record<string, unknown> = {
      categories: categoryStr ? [categoryStr] : [],
      colors: colorNames,
      tags: tagsForAttr,
    }
    if (mergedColorRows.length > 0)
      attrBody.colorImages = mergedColorRows.map((r) => ({
        color: r.color,
        hex: r.hex,
        image: r.image,
      }))
    if (Object.keys(variantsPayload).length > 0)
      attrBody.variants = variantsPayload

    const attr = parseProductAttributesBody(attrBody)

    const product = await prisma.product.create({
      data: {
        supplierId,
        name: nameStr.slice(0, 500),
        description: desc.slice(0, 8000),
        images,
        colorImages:
          attr.colorImages === null
            ? Prisma.DbNull
            : (attr.colorImages as unknown as Prisma.InputJsonValue),
        categories: attr.categories,
        colors:
          attr.colors.length > 0 ? attr.colors : colorNames.slice(0, 24),
        tags: attr.tags,
        variants:
          attr.variants === null
            ? Prisma.DbNull
            : (attr.variants as unknown as Prisma.InputJsonValue),
        basePriceCents,
        commissionRate,
        listingKind,
        stock: stockN,
        active,
        shippingCountry: ship.shippingCountry,
        warehouseType: ship.warehouseType,
        warehouseCity: ship.warehouseCity,
        processingTime: ship.processingTime,
        deliveryMin: ship.deliveryMin,
        deliveryMax: ship.deliveryMax,
        shippingMethods: ship.shippingMethods,
        freeShippingThreshold: ship.freeShippingThreshold,
        shippingCost: ship.shippingCost,
        shipsFrom: shipsFromText ?? undefined,
        deliveryDays: deliveryMid ?? undefined,
        supplierTag: "import",
      },
    })

    createdCount++
    createdProducts.push({
      id: product.id,
      name: product.name,
      sku: baseSku,
    })

    if (active && supplierStore) {
      try {
        await createNewDropCommunityPost({
          storeId: supplierStore.id,
          productId: product.id,
          productName: product.name,
        })
      } catch {
        /* non-fatal */
      }
    }

    if (active) {
      scheduleProductAutoCategorization(product.id)
    }
  }

  if (createdCount === 0) {
    return { ok: false, error: "No valid products to create", status: 400 }
  }

  return { ok: true, createdCount, products: createdProducts }
}
