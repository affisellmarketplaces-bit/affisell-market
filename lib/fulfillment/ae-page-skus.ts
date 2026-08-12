import { extractWindowJson } from "@/lib/import-url-scrape"
import { normalizeAerRoot } from "@/lib/fulfillment/ae-aer-normalize"
import {
  buildSkuPropertyLookupFromPageModule,
  labelsFromSkuAttr,
  preferHumanAeLabel,
} from "@/lib/fulfillment/ae-sku-property-lookup"
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

  const lookup = buildSkuPropertyLookupFromPageModule(skuModule)
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
    const { parts, color, size, attributes, imageUrl } = skuAttr
      ? labelsFromSkuAttr(skuAttr, lookup)
      : {
          parts: [] as string[],
          color: null as string | null,
          size: null as string | null,
          attributes: {} as Record<string, string>,
          imageUrl: null as string | null,
        }

    const aePriceCents = parsePriceCentsFromSkuVal(skuVal)
    const stock = Math.max(0, Math.round(num(skuVal.availQuantity ?? skuVal.availableStock ?? row.stock)))

    aeSkus.push({
      aeSkuId,
      aeLabel: preferHumanAeLabel(parts, skuAttr || null),
      matchColor: color ? canonicalVariantColorKey(color) : null,
      matchSize: size?.trim() || null,
      aePriceCents,
      stock,
      imageUrl,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
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
