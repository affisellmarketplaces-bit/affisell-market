import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { commissionRateForOption, parseVariantsPayload } from "@/lib/product-variants"

export const AFFILIATE_COMMISSION_REQUIRED_ERROR = "affiliate_commission_required"

export function isDonationOfferMode(offerMode?: string | null): boolean {
  return offerMode === "DONATION"
}

/** Effective affiliate commission % for a checkout line (SKU line or product default). */
export function explicitSupplierCommissionPct(args: {
  commissionRate: number
  variants?: unknown
  optionName?: string | null
}): number {
  const variants = parseVariantsPayload(args.variants ?? null)
  return commissionRateForOption({
    variants,
    optionName: args.optionName,
    productCommissionRate: args.commissionRate,
  })
}

export function productHasExplicitSupplierCommission(args: {
  commissionRate: number
  variants?: unknown
  offerMode?: string | null
  optionName?: string | null
}): boolean {
  if (isDonationOfferMode(args.offerMode)) return true
  return explicitSupplierCommissionPct(args) > 0
}

export function validateExplicitSupplierCommissionForPublish(args: {
  resolvedRate: number
  variantCommissionRates?: number[]
  offerMode?: string | null
}): { ok: true } | { ok: false; error: string } {
  if (isDonationOfferMode(args.offerMode)) {
    return { ok: true }
  }

  const variantRates = args.variantCommissionRates ?? []
  if (variantRates.length > 0) {
    for (let i = 0; i < variantRates.length; i++) {
      const pct = Math.round(Number(variantRates[i]) || 0)
      if (pct <= 0) {
        return {
          ok: false,
          error: AFFILIATE_COMMISSION_REQUIRED_ERROR,
        }
      }
    }
    return { ok: true }
  }

  if (Math.round(Number(args.resolvedRate) || 0) > 0) {
    return { ok: true }
  }

  return { ok: false, error: AFFILIATE_COMMISSION_REQUIRED_ERROR }
}

export function affiliateCommissionRequiredMessage(locale: "fr" | "en" = "fr"): string {
  return locale === "fr"
    ? "Définissez la commission offerte aux affiliés sur chaque vente (> 0 %). La grille catégorie est indicative uniquement."
    : "Set the affiliate commission offered on each sale (> 0%). The category grid is indicative only."
}

export function headlineAffiliateCommissionPct(args: {
  commissionRate: number
  variants?: unknown
}): number {
  return affiliateCommissionDisplayPct({
    commissionRate: args.commissionRate,
    variants: args.variants,
  })
}
