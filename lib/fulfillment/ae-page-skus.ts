import { extractWindowJson } from "@/lib/import-url-scrape"
import { normalizeAerRoot } from "@/lib/fulfillment/ae-aer-normalize"
import { normalizeAeSkuCandidate } from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function txt(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return ""
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(String(v ?? "").replace(/[^\d.,]/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

type PropValueMeta = {
  propName: string
  displayName: string
}

/** Build lookup `propertyId:valueId` → label from productSKUPropertyList. */
function buildSkuPropertyLookup(
  skuModule: Record<string, unknown>
): Map<string, PropValueMeta> {
  const out = new Map<string, PropValueMeta>()
  const props = Array.isArray(skuModule.productSKUPropertyList)
    ? skuModule.productSKUPropertyList
    : []

  for (const propRaw of props) {
    const prop = asRec(propRaw)
    if (!prop) continue
    const propId = txt(prop.skuPropertyId) || txt(prop.propertyId)
    const propName = txt(prop.skuPropertyName) || txt(prop.propertyName) || "Option"
    const values = Array.isArray(prop.skuPropertyValues) ? prop.skuPropertyValues : []
    for (const vRaw of values) {
      const v = asRec(vRaw)
      if (!v) continue
      const valueId = txt(v.propertyValueId) || txt(v.valueId)
      if (!propId || !valueId) continue
      const displayName =
        txt(v.propertyValueDisplayName) ||
        txt(v.propertyValueName) ||
        txt(v.name) ||
        valueId
      out.set(`${propId}:${valueId}`, { propName, displayName })
    }
  }

  return out
}

function parseSkuAttrSegment(segment: string): { propId: string; valueId: string } | null {
  const trimmed = segment.trim()
  if (!trimmed) return null
  const colon = trimmed.indexOf(":")
  if (colon <= 0) return null
  const propId = trimmed.slice(0, colon).trim()
  let valuePart = trimmed.slice(colon + 1).trim()
  const hash = valuePart.indexOf("#")
  if (hash >= 0) valuePart = valuePart.slice(0, hash).trim()
  if (!propId || !valuePart) return null
  return { propId, valueId: valuePart }
}

function labelsFromSkuAttr(
  skuAttr: string,
  lookup: Map<string, PropValueMeta>
): { parts: string[]; attributes: Record<string, string>; color: string | null; size: string | null } {
  const attributes: Record<string, string> = {}
  const parts: string[] = []
  let color: string | null = null
  let size: string | null = null

  for (const segment of skuAttr.split(";")) {
    const parsed = parseSkuAttrSegment(segment)
    if (!parsed) continue
    const meta = lookup.get(`${parsed.propId}:${parsed.valueId}`)
    if (!meta) continue
    attributes[meta.propName] = meta.displayName
    parts.push(meta.displayName)
    const propLower = meta.propName.toLowerCase()
    if (!color && (propLower.includes("color") || propLower.includes("couleur"))) {
      color = meta.displayName
    }
    if (!size && (propLower.includes("size") || propLower.includes("taille"))) {
      size = meta.displayName
    }
  }

  if (!color && parts.length === 1) color = parts[0] ?? null

  return { parts, attributes, color, size }
}

function parsePriceCentsFromSkuVal(skuVal: Record<string, unknown>): number {
  const activity = asRec(skuVal.skuActivityAmount)
  const amount = asRec(skuVal.skuAmount)
  const priceEur =
    num(activity?.value) ||
    num(amount?.value) ||
    num(skuVal.offer_sale_price) ||
    num(skuVal.sku_price)
  if (priceEur <= 0) return 0
  return Math.max(100, Math.round(priceEur * 100))
}

function pickSkuId(row: Record<string, unknown>, skuVal: Record<string, unknown>): string {
  const candidates = [
    txt(row.skuId),
    txt(row.sku_id),
    txt(row.skuIdStr),
    txt(skuVal.skuId),
    txt(skuVal.sku_id),
    txt(skuVal.skuIdStr),
    txt(skuVal.id),
    txt(row.id),
  ]
  for (const raw of candidates) {
    const normalized = normalizeAeSkuCandidate(raw)
    if (normalized) return normalized
  }
  return ""
}

export type AePageParseResult = {
  aeSkus: AeProductSkuRow[]
  aePriceCents: number
  aeShopId: string
  title: string
}

/** Parse SKU catalogue from raw `__AER_DATA__` object or HTML. */
export function parseAeSkusFromPagePayload(
  payload: unknown,
  opts?: { url?: string; html?: string }
): AePageParseResult {
  let aer = normalizeAerRoot(payload) ?? asRec(payload)
  if (!aer && opts?.html) {
    const extracted =
      extractWindowJson(opts.html, ["__AER_DATA__"]) ??
      extractWindowJson(opts.html, ["__RET_DATA__"]) ??
      extractWindowJson(opts.html, ["__INIT_DATA__"]) ??
      extractWindowJson(opts.html, ["runParams"])
    aer = normalizeAerRoot(extracted) ?? asRec(extracted)
  }
  if (!aer) {
    return { aeSkus: [], aePriceCents: 0, aeShopId: "", title: "" }
  }

  const pageModule = asRec(aer.pageModule) ?? aer
  const productInfo = asRec(asRec(pageModule.productInfoComponent)?.productInfo) ?? {}
  const skuModule = asRec(asRec(pageModule.skuComponent)?.skuModule) ?? {}
  const storeComponent = asRec(pageModule.storeComponent) ?? {}

  const lookup = buildSkuPropertyLookup(skuModule)
  const skuPriceList = Array.isArray(skuModule.skuPriceList) ? skuModule.skuPriceList : []

  const aeSkus: AeProductSkuRow[] = []
  const seenIds = new Set<string>()

  for (const rowRaw of skuPriceList) {
    const row = asRec(rowRaw)
    if (!row) continue
    const skuVal = asRec(row.skuVal) ?? row
    const aeSkuId = pickSkuId(row, skuVal)
    if (!aeSkuId || seenIds.has(aeSkuId)) continue
    seenIds.add(aeSkuId)

    const skuAttr = txt(row.skuAttr) || txt(row.sku_attr)
    const { parts, color, size } = skuAttr
      ? labelsFromSkuAttr(skuAttr, lookup)
      : { parts: [] as string[], color: null as string | null, size: null as string | null }

    const aePriceCents = parsePriceCentsFromSkuVal(skuVal)
    const stock = Math.max(0, Math.round(num(skuVal.availQuantity ?? skuVal.availableStock ?? row.stock)))

    aeSkus.push({
      aeSkuId,
      aeLabel: parts.length > 0 ? parts.join(" · ") : aeSkuId,
      matchColor: color ? canonicalVariantColorKey(color) : null,
      matchSize: size?.trim() || null,
      aePriceCents,
      stock,
    })
  }

  const prices = aeSkus.map((s) => s.aePriceCents).filter((p) => p > 0)
  const aePriceCents = prices.length > 0 ? Math.min(...prices) : 0

  const aeShopId =
    txt(productInfo.storeId) ||
    txt(productInfo.storeNum) ||
    txt(storeComponent.storeId) ||
    txt(asRec(storeComponent.storeInfo)?.storeId) ||
    ""

  return {
    aeSkus,
    aePriceCents,
    aeShopId,
    title: txt(productInfo.subject),
  }
}
