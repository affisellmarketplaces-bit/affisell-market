/** Client-safe — wholesale increase blocked while partners list live. */

import {
  detectWholesaleIncreases,
  type WholesaleSnapshot,
} from "@/lib/affiliate-wholesale-change-guard"

export const SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE = "PRICE_INCREASE_REQUIRES_RECALL" as const

export type SupplierWholesaleIncreaseBlock = {
  code: typeof SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE
  listedAffiliateCount: number
  increaseCount: number
  message: string
}

export function supplierWholesaleIncreaseBlockMessage(
  listedAffiliateCount: number,
  locale: "fr" | "en" = "fr"
): string {
  if (locale === "en") {
    return listedAffiliateCount === 1
      ? "Price increase blocked — 1 reseller is live. Recall the product before raising wholesale."
      : `Price increase blocked — ${listedAffiliateCount} resellers are live. Recall the product before raising wholesale.`
  }
  return listedAffiliateCount === 1
    ? "Hausse bloquée — 1 revendeur en vitrine. Rappelez le produit avant d'augmenter le prix wholesale."
    : `Hausse bloquée — ${listedAffiliateCount} revendeurs en vitrine. Rappelez le produit avant d'augmenter le prix wholesale.`
}

export function evaluateSupplierWholesaleIncreaseBlock(args: {
  isLive: boolean
  before: WholesaleSnapshot
  after: WholesaleSnapshot
  listedAffiliateCount: number
  locale?: "fr" | "en"
}): SupplierWholesaleIncreaseBlock | null {
  if (!args.isLive || args.listedAffiliateCount <= 0) return null
  const increases = detectWholesaleIncreases(args.before, args.after)
  if (increases.length === 0) return null
  return {
    code: SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE,
    listedAffiliateCount: args.listedAffiliateCount,
    increaseCount: increases.length,
    message: supplierWholesaleIncreaseBlockMessage(
      args.listedAffiliateCount,
      args.locale ?? "fr"
    ),
  }
}
