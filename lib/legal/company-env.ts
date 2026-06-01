/** Société Affisell — variables d'environnement (Stripe / RGPD / mentions). */
export function readCompanyLegal() {
  return {
    name: process.env.COMPANY_NAME?.trim() || "Affisell SAS",
    siret: process.env.COMPANY_SIRET?.trim() || "[PLACEHOLDER — SIRET]",
    address: process.env.COMPANY_ADDRESS?.trim() || "[PLACEHOLDER — adresse du siège social]",
    capital: process.env.COMPANY_CAPITAL?.trim() || "[PLACEHOLDER — capital social en euros]",
    publisher: process.env.PUBLISHER_NAME?.trim() || "[PLACEHOLDER — directeur de publication]",
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || "support@affisell.com",
    dpoEmail: process.env.DPO_EMAIL?.trim() || "dpo@affisell.com",
    contactEmail: process.env.COMPANY_CONTACT_EMAIL?.trim() || "contact@affisell.com",
  }
}
