import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"

/** Hosting provider — LCEN art. 6 III 2°. */
export const VERCEL_HOST_LEGAL = {
  name: AFFISELL_LEGAL_IDENTITY.hostPrimary.name,
  street: AFFISELL_LEGAL_IDENTITY.hostPrimary.street,
  city: AFFISELL_LEGAL_IDENTITY.hostPrimary.city,
  state: AFFISELL_LEGAL_IDENTITY.hostPrimary.state,
  postalCode: AFFISELL_LEGAL_IDENTITY.hostPrimary.postalCode,
  countryFr: AFFISELL_LEGAL_IDENTITY.hostPrimary.countryFr,
  countryEn: "United States",
  website: AFFISELL_LEGAL_IDENTITY.hostPrimary.website,
} as const

/** EU online dispute resolution platform (Règl. UE 524/2013). */
export const EU_CONSUMER_ODR_URL = "https://ec.europa.eu/consumers/odr"

export function formatVatIntracommunautaire(tva: string, vatRegimeFallback?: string): string {
  const digits = tva.replace(/\D/g, "")
  if (!digits) {
    return vatRegimeFallback?.trim() || AFFISELL_LEGAL_IDENTITY.vatRegimeFr
  }
  const suffix = digits.length >= 11 ? digits.slice(0, 11) : digits.padStart(11, "0")
  return `FR${suffix}`
}
