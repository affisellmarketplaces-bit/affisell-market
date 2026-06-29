/** Société Affisell — source unique (pages légales, markdown, factures, footer). */

export type CompanyLegal = {
  name: string
  siret: string
  siren: string
  address: string
  domiciliationAddress: string
  legalForm: string
  capital: string
  publisher: string
  supportEmail: string
  dpoEmail: string
  contactEmail: string
  tva: string
  rcs: string
  mediatorUrl: string
  mediatorName: string
  host: string
}

const DEFAULT_HOST =
  "Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis — vercel.com"

function envFirst(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

/** SIREN = 9 premiers chiffres du SIRET (France). */
export function deriveSirenFromSiret(siret: string): string {
  const digits = siret.replace(/\D/g, "")
  if (digits.length >= 9) return digits.slice(0, 9)
  return siret.trim()
}

function resolveSiren(siret: string): string {
  const explicit = envFirst(["AFFISELL_SIREN", "NEXT_PUBLIC_COMPANY_SIREN"])
  if (explicit) {
    const digits = explicit.replace(/\D/g, "")
    return digits.length >= 9 ? digits.slice(0, 9) : explicit
  }
  if (siret.includes("PLACEHOLDER")) {
    return "[PLACEHOLDER — SIREN]"
  }
  return deriveSirenFromSiret(siret)
}

export function readCompanyLegal(): CompanyLegal {
  const name = envFirst(["COMPANY_NAME", "NEXT_PUBLIC_COMPANY_NAME"]) ?? "Affisell SAS"
  const siret =
    envFirst(["COMPANY_SIRET", "NEXT_PUBLIC_COMPANY_SIRET"]) ?? "[PLACEHOLDER — SIRET]"
  const siren = resolveSiren(siret)
  const address =
    envFirst(["COMPANY_ADDRESS", "AFFISELL_ADDRESS", "NEXT_PUBLIC_COMPANY_ADDRESS"]) ??
    "[PLACEHOLDER — adresse du siège social]"
  const capital =
    envFirst(["COMPANY_CAPITAL", "AFFISELL_CAPITAL"]) ??
    "[PLACEHOLDER — capital social en euros]"
  const publisher =
    envFirst(["PUBLISHER_NAME"]) ?? "[PLACEHOLDER — directeur de publication]"
  const tva = envFirst(["AFFISELL_TVA", "NEXT_PUBLIC_COMPANY_VAT", "COMPANY_VAT"]) ?? ""
  const rcs =
    envFirst(["AFFISELL_RCS"]) ??
    (siren.includes("PLACEHOLDER") ? "RCS Aix-en-Provence {{SIREN}}" : `RCS Aix-en-Provence ${siren}`)
  const domiciliationAddress =
    envFirst(["COMPANY_DOMICILIATION_ADDRESS", "AFFISELL_DOMICILIATION_ADDRESS"]) ?? address
  const legalForm =
    envFirst(["COMPANY_LEGAL_FORM", "AFFISELL_LEGAL_FORM"]) ??
    "Société par actions simplifiée (SAS)"
  const mediatorName =
    envFirst(["MEDIATOR_NAME", "AFFISELL_MEDIATOR_NAME"]) ?? "TODO_MEDIATEUR_NOM"
  const mediatorUrl =
    envFirst(["NEXT_PUBLIC_MEDIATOR_URL", "MEDIATOR_URL"]) ?? "TODO_SITE"

  return {
    name,
    siret,
    siren,
    address,
    capital,
    publisher,
    supportEmail: envFirst(["SUPPORT_EMAIL"]) ?? "support@affisell.com",
    dpoEmail: envFirst(["DPO_EMAIL"]) ?? "dpo@affisell.com",
    contactEmail: envFirst(["COMPANY_CONTACT_EMAIL"]) ?? "contact@affisell.com",
    tva,
    rcs,
    mediatorUrl,
    mediatorName,
    domiciliationAddress,
    legalForm,
    host: DEFAULT_HOST,
  }
}

/** Forme legacy pour PDF / pages marketing. */
export function readAffisellLegalEntity() {
  const c = readCompanyLegal()
  return {
    companyName: c.name,
    siren: c.siren,
    rcs: c.rcs,
    tva: c.tva,
    capitalEur: c.capital,
    address: c.address,
    email: c.contactEmail,
    dpoEmail: c.dpoEmail,
    host: c.host,
  }
}
