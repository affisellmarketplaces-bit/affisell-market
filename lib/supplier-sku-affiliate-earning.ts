import { ILLUSTRATIVE_RETAIL_MARKUP_PCT } from "@/lib/affiliate-earnings-hint"

export type AffiliateEarningInput = {
  supplierPrice: number
  commissionRate: number
  compareAtEur?: number | null
  /** Override illustrative retail (e.g. affiliate selling price). */
  publicPriceEur?: number | null
}

/** Retail anchor for commission display when affiliate price is unknown. */
export function illustrativePublicPriceEur(input: AffiliateEarningInput): number {
  if (input.publicPriceEur != null && input.publicPriceEur > 0) {
    return input.publicPriceEur
  }
  if (input.compareAtEur != null && input.compareAtEur > input.supplierPrice) {
    return input.compareAtEur
  }
  const uplift = 1 + ILLUSTRATIVE_RETAIL_MARKUP_PCT / 100
  return Math.round(input.supplierPrice * uplift * 100) / 100
}

/** Commission EUR per sale: publicPrice × commissionRate / 100 (per product spec). */
export function affiliateMarginEur(input: AffiliateEarningInput): number {
  const pub = illustrativePublicPriceEur(input)
  const rate = Math.min(100, Math.max(0, input.commissionRate))
  return Math.round(pub * (rate / 100) * 100) / 100
}

export type AffiliateMarginTone = "good" | "low" | "neutral"

export function affiliateMarginTone(amountEur: number): AffiliateMarginTone {
  if (amountEur > 2) return "good"
  if (amountEur < 1) return "low"
  return "neutral"
}

export function affiliateMarginToneClass(tone: AffiliateMarginTone): string {
  switch (tone) {
    case "good":
      return "text-emerald-700 dark:text-emerald-400"
    case "low":
      return "text-amber-700 dark:text-amber-400"
    default:
      return "text-zinc-700 dark:text-zinc-300"
  }
}

export type AffiliateCatalogPreviewInput = {
  supplierPriceEur: number
  commissionRate: number
  compareAtEur?: number | null
  weightGrams?: number | null
  processingDays?: number | null
  warehouseCode?: string | null
  shipsFrom?: string | null
  deliveryDays?: number | null
}

/** Single-line hint shown in supplier « Aperçu catalogue affiliés ». */
export function formatAffiliateCatalogPreviewLine(input: AffiliateCatalogPreviewInput): string {
  const earn = affiliateMarginEur({
    supplierPrice: input.supplierPriceEur,
    commissionRate: input.commissionRate,
    compareAtEur: input.compareAtEur,
  })
  const parts: string[] = [`Tu gagnes : ${earn.toFixed(2)}€ par vente`]

  const warehouse = (input.warehouseCode ?? input.shipsFrom ?? "EU").trim().toUpperCase()
  const days = input.processingDays ?? input.deliveryDays ?? 2
  parts.push(`Expédié depuis ${warehouse} sous ${days}j`)

  if (input.weightGrams != null && input.weightGrams > 0) {
    parts.push(`Poids : ${input.weightGrams}g`)
  }

  return parts.join(" | ")
}
