import { readAffisellLegalEntity, readCompanyLegal } from "@/lib/legal/company-env"

export { LEGAL_DOC_VERSION } from "@/lib/legal/entity-constants"

/** @deprecated Préférer `readCompanyLegal()` — conservé pour imports existants. */
export function getAffisellLegalSnapshot() {
  return readAffisellLegalEntity()
}

export function applyLegalPlaceholders(text: string, lastUpdated?: string): string {
  const c = readCompanyLegal()
  const date = lastUpdated ?? new Date().toISOString().slice(0, 10)
  return text
    .replaceAll("{{SIREN}}", c.siren)
    .replaceAll("{{RCS}}", c.rcs)
    .replaceAll("{{TVA}}", c.tva || "{{TVA}}")
    .replaceAll("{{CAPITAL}}", c.capital)
    .replaceAll("{{ADRESSE}}", c.address)
    .replaceAll("{{LAST_UPDATED}}", date)
    .replaceAll("{{DPO}}", c.dpoEmail)
    .replaceAll("{{EMAIL}}", c.contactEmail)
}
