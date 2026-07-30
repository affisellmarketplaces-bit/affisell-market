import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { EU_CONSUMER_ODR_URL } from "@/lib/legal/mentions-constants"

/** Affisell — source unique (pages légales, markdown, factures, footer). */

export type CompanyLegal = {
  name: string
  /** Nom civil du micro-entrepreneur. */
  legalName: string
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
  /** Message régime TVA (ex. art. 293 B) lorsque pas de n° TVA. */
  vatRegime: string
  naf: string
  rcs: string
  /** Médiateur consommation L.612-1 (ex. CM2C). */
  mediatorUrl: string
  mediatorName: string
  /** Plateforme ODR UE (secondaire). */
  odrUrl: string
  host: string
}

const id = AFFISELL_LEGAL_IDENTITY

const DEFAULT_HOST = `${id.hostPrimary.name} — ${id.hostPrimary.street}, ${id.hostPrimary.city}, ${id.hostPrimary.state} ${id.hostPrimary.postalCode}, ${id.hostPrimary.countryFr} — ${id.hostPrimary.website.replace(/^https?:\/\//, "")} · ${id.hostSecondary.name} (données)`

const DEFAULT_MEDIATOR_NAME = "CM2C — Centre de la médiation de la consommation"
const DEFAULT_MEDIATOR_URL = "https://www.cm2c.net"

function envFirst(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

const SUPPORT_EMAIL_FALLBACK = "support@affisell.com"

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(raw)
}

/** Reject truncated env values like `support@` (missing domain). */
export function resolveSupportEmail(): string {
  const raw = envFirst([
    "SUPPORT_EMAIL",
    "NEXT_PUBLIC_SUPPORT_EMAIL",
    "NEXT_PUBLIC_CONTACT_EMAIL",
    "COMPANY_CONTACT_EMAIL",
  ])
  if (!raw) return SUPPORT_EMAIL_FALLBACK
  if (!isValidEmail(raw)) {
    console.warn("[company-env] Invalid SUPPORT_EMAIL, using fallback", { raw })
    return SUPPORT_EMAIL_FALLBACK
  }
  return raw
}

/**
 * Public contact for legal pages.
 * Prefer explicit contact env; else support — never leave a broken placeholder on live pages.
 * Address domiciliation remains a separate placeholder until COMPANY_ADDRESS is set.
 */
export function resolveContactEmail(): string {
  const raw = envFirst([
    "NEXT_PUBLIC_CONTACT_EMAIL",
    "COMPANY_CONTACT_EMAIL",
    "SUPPORT_EMAIL",
    "NEXT_PUBLIC_SUPPORT_EMAIL",
  ])
  if (!raw || !isValidEmail(raw)) return SUPPORT_EMAIL_FALLBACK
  return raw
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
  const name = envFirst(["COMPANY_NAME", "NEXT_PUBLIC_COMPANY_NAME"]) ?? id.commercialName
  const legalName =
    envFirst(["COMPANY_LEGAL_NAME", "PUBLISHER_NAME", "AFFISELL_LEGAL_NAME"]) ?? id.legalName
  const siret =
    envFirst(["COMPANY_SIRET", "NEXT_PUBLIC_COMPANY_SIRET"]) ?? id.siret
  const siren = resolveSiren(siret)
  const address =
    envFirst(["COMPANY_ADDRESS", "AFFISELL_ADDRESS", "NEXT_PUBLIC_COMPANY_ADDRESS"]) ??
    id.address
  const capital =
    envFirst(["COMPANY_CAPITAL", "AFFISELL_CAPITAL"]) ?? "Sans capital social (entreprise individuelle)"
  const publisher = envFirst(["PUBLISHER_NAME"]) ?? id.legalName
  const tva = envFirst(["AFFISELL_TVA", "NEXT_PUBLIC_COMPANY_VAT", "COMPANY_VAT"]) ?? ""
  const vatRegime =
    envFirst(["AFFISELL_VAT_REGIME", "COMPANY_VAT_REGIME"]) ??
    (tva ? "" : id.vatRegimeFr)
  const naf =
    envFirst(["COMPANY_NAF", "AFFISELL_NAF"]) ?? `${id.nafCode} — ${id.nafLabel}`
  const rcs = envFirst(["AFFISELL_RCS"]) ?? id.rcs
  const domiciliationAddress =
    envFirst(["COMPANY_DOMICILIATION_ADDRESS", "AFFISELL_DOMICILIATION_ADDRESS"]) ?? address
  const legalForm =
    envFirst(["COMPANY_LEGAL_FORM", "AFFISELL_LEGAL_FORM"]) ?? id.legalForm

  const mediationOrg = envFirst(["MEDIATION_ORG", "AFFISELL_MEDIATION_ORG"])
  const mediatorName =
    envFirst(["MEDIATOR_NAME", "AFFISELL_MEDIATOR_NAME"]) ??
    (mediationOrg ? `${mediationOrg} — Centre de la médiation de la consommation` : DEFAULT_MEDIATOR_NAME)
  const mediatorUrl =
    envFirst(["NEXT_PUBLIC_MEDIATOR_URL", "MEDIATOR_URL"]) ?? DEFAULT_MEDIATOR_URL
  const odrUrl = envFirst(["NEXT_PUBLIC_ODR_URL", "ODR_URL"]) ?? EU_CONSUMER_ODR_URL

  const contactEmail = resolveContactEmail()
  const supportEmail = resolveSupportEmail()
  const dpoEmail = envFirst(["DPO_EMAIL"]) ?? "dpo@affisell.com"

  return {
    name,
    legalName,
    siret,
    siren,
    address,
    capital,
    publisher,
    supportEmail,
    dpoEmail,
    contactEmail,
    tva,
    vatRegime,
    naf,
    rcs,
    mediatorUrl,
    mediatorName,
    odrUrl,
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
    legalName: c.legalName,
    siren: c.siren,
    rcs: c.rcs,
    tva: c.tva || c.vatRegime,
    capitalEur: c.capital,
    address: c.address,
    email: c.contactEmail,
    dpoEmail: c.dpoEmail,
    host: c.host,
    naf: c.naf,
  }
}
