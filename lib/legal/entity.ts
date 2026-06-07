import { readAffisellLegalEntity, readCompanyLegal } from "@/lib/legal/company-env"
import { legalPlatformFeeLabels } from "@/lib/legal/fee-labels"

export { LEGAL_DOC_VERSION } from "@/lib/legal/entity-constants"

/** @deprecated Préférer `readCompanyLegal()` — conservé pour imports existants. */
export function getAffisellLegalSnapshot() {
  return readAffisellLegalEntity()
}

export function applyLegalPlaceholders(text: string, lastUpdated?: string): string {
  const c = readCompanyLegal()
  const date = lastUpdated ?? new Date().toISOString().slice(0, 10)
  const fees = legalPlatformFeeLabels
  return text
    .replaceAll("{{COMPANY_NAME}}", c.name)
    .replaceAll("{{SIREN}}", c.siren)
    .replaceAll("{{SIRET}}", c.siret)
    .replaceAll("{{RCS}}", c.rcs)
    .replaceAll("{{TVA}}", c.tva || "{{TVA}}")
    .replaceAll("{{CAPITAL}}", c.capital)
    .replaceAll("{{ADRESSE}}", c.address)
    .replaceAll("{{LAST_UPDATED}}", date)
    .replaceAll("{{DPO}}", c.dpoEmail)
    .replaceAll("{{EMAIL}}", c.contactEmail)
    .replaceAll("{{SUPPORT_EMAIL}}", c.supportEmail)
    .replaceAll("{{CONTACT_EMAIL}}", c.contactEmail)
    .replaceAll("{{PUBLISHER}}", c.publisher)
    .replaceAll("{{MEDIATOR_URL}}", c.mediatorUrl)
    .replaceAll("{{SUPPLIER_CATALOG_FEE}}", fees.supplierCatalog)
    .replaceAll("{{SUPPLIER_AUTO_BUY_FEE}}", fees.supplierAutoBuy)
    .replaceAll("{{AFFILIATE_EARNINGS_FEE}}", fees.affiliateEarnings)
    .replaceAll("{{LEGACY_ORDER_FEE}}", fees.legacyOrderHtPercent)
    .replaceAll("{{PAYOUT_DAYS}}", String(fees.payoutDaysAfterBuyerConfirm))
}
