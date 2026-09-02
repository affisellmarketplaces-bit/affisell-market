/**
 * Qualification juridique Affisell — commissionnaire-affilié (Art. L132-1 C. com.).
 * Mandataire non transparent : vente au nom propre pour le compte du fournisseur, sans stock.
 */

export const AFFILIATE_LEGAL_QUALIFICATION =
  "COMMISSIONNAIRE_AFFILIE_L132-1" as const

export const AFFILIATE_COMMISSIONNAIRE_LABEL_FR = "Affilié-Commissionnaire"
export const AFFILIATE_COMMISSIONNAIRE_LABEL_EN = "Affiliate-Commission Agent"

export const AFFILIATE_CONTRACT_TITLE_FR =
  "Contrat d'Affiliation-Commission en vente directe sans stock (Art. L132-1)"

export const AFFILIATE_MANDATE_DISCLAIMER_FR =
  "Agissant en son nom propre et pour le compte du fournisseur, sans détention de stock"

export const AFFILIATE_MANDATE_DISCLAIMER_EN =
  "Acting in its own name and on behalf of the supplier, without holding inventory"

export const INVOICE_COMMISSIONNAIRE_FOOTER_FR =
  "Vente en qualité de commissionnaire-affilié — Livraison directe fournisseur"

export const INVOICE_COMMISSIONNAIRE_FOOTER_EN =
  "Sale as affiliate-commission agent — Direct supplier delivery"

export type CommissionnaireCheckoutLabels = {
  affiliateName: string
  supplierName: string
}

/** Checkout / PDP disclaimer — buyer sees affiliate as seller, supplier as fulfiller. */
export function commissionnaireCheckoutDisclaimer(
  labels: CommissionnaireCheckoutLabels,
  locale: "fr" | "en" = "fr"
): string {
  if (locale === "en") {
    return `Sold and invoiced by ${labels.affiliateName} (${AFFILIATE_COMMISSIONNAIRE_LABEL_EN}), delivered by ${labels.supplierName} on its behalf. ${AFFILIATE_MANDATE_DISCLAIMER_EN}.`
  }
  return `Vendu et facturé par ${labels.affiliateName} (${AFFILIATE_COMMISSIONNAIRE_LABEL_FR}), livré par ${labels.supplierName} pour son compte. ${AFFILIATE_MANDATE_DISCLAIMER_FR}.`
}

export type AffiliateSaleAmounts = {
  supplierPriceCents: number
  marginAmountCents: number
  commissionAmountCents: number
  resalePriceCents: number
  pricingFreedom: boolean
}

/** Derive legal sale snapshot from persisted order economics (idempotent inputs). */
export function affiliateSaleAmountsFromOrder(order: {
  supplierPriceCents: number
  affiliateMarginCents: number
  affiliatePayoutCents: number
  sellingPriceCents: number
}): AffiliateSaleAmounts {
  const marginAmountCents = Math.max(0, order.affiliateMarginCents)
  const commissionAmountCents = Math.max(0, order.affiliatePayoutCents)
  const supplierPriceCents = Math.max(0, order.supplierPriceCents)
  const resalePriceCents = supplierPriceCents + marginAmountCents

  return {
    supplierPriceCents,
    marginAmountCents,
    commissionAmountCents,
    resalePriceCents,
    pricingFreedom: marginAmountCents >= 0,
  }
}
