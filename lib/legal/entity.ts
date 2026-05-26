/** Mentions légales Affisell — remplacer via variables d'environnement en production. */
export const AFFISELL_LEGAL = {
  companyName: "Affisell SAS",
  siren: process.env.AFFISELL_SIREN ?? "{{SIREN}}",
  rcs: process.env.AFFISELL_RCS ?? "RCS Aix-en-Provence {{SIREN}}",
  tva: process.env.AFFISELL_TVA ?? "{{TVA}}",
  capitalEur: process.env.AFFISELL_CAPITAL ?? "{{CAPITAL}}",
  address: process.env.AFFISELL_ADDRESS ?? "{{ADRESSE}}",
  email: "contact@affisell.com",
  dpoEmail: "dpo@affisell.com",
  host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
} as const

export const LEGAL_DOC_VERSION = "2026-05-26"

export function applyLegalPlaceholders(text: string, lastUpdated?: string): string {
  const date = lastUpdated ?? new Date().toISOString().slice(0, 10)
  return text
    .replaceAll("{{SIREN}}", AFFISELL_LEGAL.siren)
    .replaceAll("{{RCS}}", AFFISELL_LEGAL.rcs)
    .replaceAll("{{TVA}}", AFFISELL_LEGAL.tva)
    .replaceAll("{{CAPITAL}}", AFFISELL_LEGAL.capitalEur)
    .replaceAll("{{ADRESSE}}", AFFISELL_LEGAL.address)
    .replaceAll("{{LAST_UPDATED}}", date)
    .replaceAll("{{DPO}}", AFFISELL_LEGAL.dpoEmail)
    .replaceAll("{{EMAIL}}", AFFISELL_LEGAL.email)
}
