/**
 * Why a reseller's listing can not be bought right now — ONE definition shared by the
 * next-best-action card and the replacement flow. Pure, client-safe.
 */
import { mayListOnProduct } from "@/lib/reseller-import/review"
import { productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"
import type { ReplacementProblem } from "@/lib/reseller-replacement/match"

export type ListingProductFacts = {
  active: boolean
  isDraft: boolean
  tags: string[] | null
  stock: number
  hasVariants: boolean
  variants: unknown
  listingKind: string | null
  commissionRate: number
  offerMode: string | null
}

/** Physical units a buyer can take: SKU rows when present, else the product stock; null = unknown / not stocked. */
export function availableUnits(p: Pick<ListingProductFacts, "listingKind" | "stock" | "hasVariants" | "variants">): number | null {
  const kind = (p.listingKind ?? "PHYSICAL").toUpperCase()
  if (kind !== "PHYSICAL") return null
  const rows = (p.variants as { variantRows?: Array<{ stock?: unknown }> } | null)?.variantRows
  if (Array.isArray(rows) && rows.length > 0) {
    return rows.reduce((s, r) => s + (Number(r?.stock) > 0 ? Math.round(Number(r?.stock)) : 0), 0)
  }
  if (p.hasVariants) return null
  return Math.max(0, p.stock)
}

export function listingProblem(p: ListingProductFacts): ReplacementProblem | null {
  if (!mayListOnProduct({ active: p.active, isDraft: p.isDraft, tags: p.tags })) {
    return !p.active || p.isDraft ? "product_unavailable" : "awaiting_review"
  }
  if (!productHasExplicitSupplierCommission({ commissionRate: p.commissionRate, variants: p.variants, offerMode: p.offerMode })) {
    return "no_commission"
  }
  if (availableUnits(p) === 0) return "out_of_stock"
  return null
}
