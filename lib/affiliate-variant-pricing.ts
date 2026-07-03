import { normalizeVariantPromotionKey } from "@/lib/affiliate-storefront-variants"
import {
  marketplaceSellingPriceCentsForOption,
  parseVariantsPayload,
  type ProductVariantsJson,
} from "@/lib/product-variants"
import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
import { splitVariantLineName } from "@/lib/supplier-sku-builder"

export type AffiliateVariantPriceEntry = {
  sellingPriceCents: number
  marginCents: number
}

export type AffiliateVariantPricingMap = Record<string, AffiliateVariantPriceEntry>

function normalizePricingKey(key: string): string {
  return normalizeVariantPromotionKey(key)
}

export function parseAffiliateVariantPricingJson(raw: unknown): AffiliateVariantPricingMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: AffiliateVariantPricingMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizePricingKey(k)
    if (!key || !v || typeof v !== "object" || Array.isArray(v)) continue
    const row = v as Record<string, unknown>
    const sellingPriceCents =
      typeof row.sellingPriceCents === "number" && Number.isFinite(row.sellingPriceCents)
        ? Math.max(0, Math.round(row.sellingPriceCents))
        : null
    if (sellingPriceCents == null) continue
    const marginCents =
      typeof row.marginCents === "number" && Number.isFinite(row.marginCents)
        ? Math.max(0, Math.round(row.marginCents))
        : 0
    out[key] = { sellingPriceCents, marginCents }
  }
  return out
}

export function wholesaleCentsForAffiliateOption(args: {
  optionKey: string
  optionColor: string | null
  optionSize: string | null
  productBasePriceCents: number
  variants: unknown
  productVariants?: Array<{
    color: string | null
    size: string | null
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}): number {
  const base = Math.max(0, Math.round(args.productBasePriceCents))
  const parsed = parseVariantsPayload(args.variants)
  const fromRow = resolveWholesaleFromVariantRows(parsed, args.optionKey, args.optionColor)
  if (fromRow != null) return fromRow

  if (args.productVariants?.length) {
    const label = buildVariantOptionLabel(args.optionColor, args.optionSize)
    for (const v of args.productVariants) {
      const vLabel = buildVariantOptionLabel(v.color, v.size)
      if (vLabel.toLowerCase() !== label.toLowerCase() && vLabel.toLowerCase() !== args.optionKey.toLowerCase()) {
        continue
      }
      if (v.wholesalePriceCents != null && v.wholesalePriceCents > 0) {
        return Math.round(v.wholesalePriceCents)
      }
      const sp = v.supplierPrice
      if (sp != null) {
        const n = typeof sp === "number" ? sp : Number(String(sp).replace(",", "."))
        if (Number.isFinite(n) && n > 0) return Math.max(100, Math.round(n * 100))
      }
    }
  }

  return base
}

function resolveWholesaleFromVariantRows(
  variants: ProductVariantsJson | null,
  optionKey: string,
  optionColor: string | null
): number | null {
  const rows = variants?.variantRows ?? []
  if (rows.length === 0) return null
  const keyLower = optionKey.toLowerCase()
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    if (name.toLowerCase() === keyLower || name.toLowerCase().startsWith(`${keyLower} /`)) {
      return row.priceCents > 0 ? row.priceCents : null
    }
    const { color } = splitVariantLineName(name)
    if (optionColor && color.toLowerCase() === optionColor.toLowerCase() && row.priceCents > 0) {
      return row.priceCents
    }
  }
  return null
}

export function lookupVariantPricingEntry(
  map: AffiliateVariantPricingMap | null | undefined,
  optionName: string | null | undefined
): AffiliateVariantPriceEntry | null {
  if (!map || !optionName?.trim()) return null
  const direct = map[normalizePricingKey(optionName)]
  if (direct) return direct
  const lower = optionName.trim().toLowerCase()
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v
  }
  return null
}

/** Shopper unit price — per-variant override wins, else wholesale delta formula. */
export function resolveAffiliateSellingPriceCentsForOption(args: {
  listingSellingPriceCents: number
  productBasePriceCents: number
  variants: ProductVariantsJson | null
  optionName?: string | null
  variantPricing?: AffiliateVariantPricingMap | null
}): number {
  const override = lookupVariantPricingEntry(args.variantPricing, args.optionName)
  if (override?.sellingPriceCents != null && override.sellingPriceCents > 0) {
    return override.sellingPriceCents
  }
  return marketplaceSellingPriceCentsForOption({
    listingSellingPriceCents: args.listingSellingPriceCents,
    productBasePriceCents: args.productBasePriceCents,
    variants: args.variants,
    optionName: args.optionName,
  })
}

export function sellingPriceCentsFromMargin(args: {
  wholesaleCents: number
  marginEuro: number
}): number {
  const wholesale = Math.max(0, Math.round(args.wholesaleCents))
  const marginCents = Math.max(0, Math.round(args.marginEuro * 100))
  return Math.max(wholesale, wholesale + marginCents)
}

export function marginEuroFromPrices(wholesaleCents: number, sellingPriceCents: number): number {
  return Math.max(0, sellingPriceCents - wholesaleCents) / 100
}

export function buildVariantPricingFromMargins(args: {
  options: Array<{ key: string; wholesaleCents: number }>
  pick: Record<string, boolean>
  marginEuroByKey: Record<string, string>
}): AffiliateVariantPricingMap {
  const out: AffiliateVariantPricingMap = {}
  for (const opt of args.options) {
    if (!args.pick[opt.key]) continue
    const raw = args.marginEuroByKey[opt.key]
    const marginEuro = Number(String(raw ?? "").replace(",", "."))
    if (!Number.isFinite(marginEuro) || marginEuro < 0) continue
    const sellingPriceCents = sellingPriceCentsFromMargin({
      wholesaleCents: opt.wholesaleCents,
      marginEuro,
    })
    out[opt.key] = {
      sellingPriceCents,
      marginCents: Math.max(0, sellingPriceCents - opt.wholesaleCents),
    }
  }
  return out
}

export function parseVariantPricingBody(args: {
  raw: unknown
  allowedKeys: string[]
  wholesaleByKey: Map<string, number>
}): { variantPricing: AffiliateVariantPricingMap } | { error: string } {
  if (args.raw === undefined || args.raw === null) {
    return { variantPricing: {} }
  }
  const parsed = parseAffiliateVariantPricingJson(args.raw)
  const allowed = new Set(args.allowedKeys.map((k) => k.toLowerCase()))
  const out: AffiliateVariantPricingMap = {}

  for (const [k, entry] of Object.entries(parsed)) {
    const key = normalizePricingKey(k)
    if (!allowed.has(key.toLowerCase())) continue
    const wholesale = args.wholesaleByKey.get(key) ?? args.wholesaleByKey.get(k) ?? 0
    if (entry.sellingPriceCents < wholesale) {
      return { error: `Prix variante « ${key} » doit être ≥ prix fournisseur.` }
    }
    const marginCents = Math.max(0, entry.sellingPriceCents - wholesale)
    out[key] = { sellingPriceCents: entry.sellingPriceCents, marginCents }
  }

  return { variantPricing: out }
}

export function serializeVariantPricingForDb(
  map: AffiliateVariantPricingMap
): Record<string, AffiliateVariantPriceEntry> | null {
  const keys = Object.keys(map)
  if (keys.length === 0) return null
  return map
}
