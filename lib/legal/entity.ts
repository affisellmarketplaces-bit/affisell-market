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
  const emailForDocs =
    c.contactEmail.includes("@") && !c.contactEmail.includes("À compléter")
      ? c.contactEmail
      : c.supportEmail
  return text
    .replaceAll("{{COMPANY_NAME}}", c.name)
    .replaceAll("{{SIREN}}", c.siren)
    .replaceAll("{{SIRET}}", c.siret)
    .replaceAll("{{RCS}}", c.rcs)
    .replaceAll("{{TVA}}", c.tva || c.vatRegime || "{{TVA}}")
    .replaceAll("{{CAPITAL}}", c.capital)
    .replaceAll("{{ADRESSE}}", c.address)
    .replaceAll("{{LAST_UPDATED}}", date)
    .replaceAll("{{DPO}}", c.dpoEmail)
    .replaceAll("{{EMAIL}}", emailForDocs)
    .replaceAll("{{SUPPORT_EMAIL}}", c.supportEmail)
    .replaceAll("{{CONTACT_EMAIL}}", emailForDocs)
    .replaceAll("{{PUBLISHER}}", c.publisher)
    .replaceAll("{{DOMICILIATION}}", c.domiciliationAddress)
    .replaceAll("{{LEGAL_NAME}}", c.legalName)
    .replaceAll("{{NAF}}", c.naf)
    .replaceAll("{{VAT_REGIME}}", c.vatRegime || c.tva || "")
    .replaceAll("{{MEDIATOR_NAME}}", c.mediatorName)
    .replaceAll("{{MEDIATOR_SITE}}", c.mediatorUrl)
    .replaceAll("{{MEDIATOR_URL}}", c.mediatorUrl)
    .replaceAll("{{SUPPLIER_CATALOG_FEE}}", fees.supplierCatalog)
    .replaceAll("{{SUPPLIER_AUTO_BUY_FEE}}", fees.supplierAutoBuy)
    .replaceAll("{{AFFILIATE_EARNINGS_FEE}}", fees.affiliateEarnings)
    .replaceAll("{{LEGACY_ORDER_FEE}}", fees.legacyOrderHtPercent)
    .replaceAll("{{PAYOUT_DAYS}}", String(fees.payoutDaysAfterBuyerConfirm))
}
