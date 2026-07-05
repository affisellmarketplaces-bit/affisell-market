/**
 * Trusted carriers per destination country (AfterShip-compatible slugs).
 * Client-safe — no Prisma / server-only imports.
 */

import {
  resolveShipTrackingPolicy,
  type ShipTrackingPolicy,
} from "@/lib/ship-tracking-policy.shared"

export type TrustedCarrier = {
  label: string
  afterShipSlug: string
}

/** Last resort when the carrier is not in the country list (no AfterShip slug). */
export const OTHER_TRUSTED_CARRIER_LABEL = "Autre"

const C = (label: string, afterShipSlug: string): TrustedCarrier => ({ label, afterShipSlug })

const FR: readonly TrustedCarrier[] = [
  C("Colissimo", "colissimo"),
  C("Chronopost", "chronopost"),
  C("Mondial Relay", "mondialrelay"),
  C("DPD France", "dpd"),
  C("UPS", "ups"),
  C("DHL", "dhl"),
]

const DE: readonly TrustedCarrier[] = [
  C("DHL", "dhl"),
  C("DPD Germany", "dpd-de"),
  C("Hermes", "hermes-de"),
  C("GLS", "gls"),
  C("UPS", "ups"),
]

const BE: readonly TrustedCarrier[] = [
  C("bpost", "bpost"),
  C("DPD", "dpd"),
  C("Mondial Relay", "mondialrelay"),
  C("UPS", "ups"),
  C("DHL", "dhl"),
]

const NL: readonly TrustedCarrier[] = [
  C("PostNL", "postnl"),
  C("DHL", "dhl"),
  C("DPD", "dpd"),
  C("UPS", "ups"),
]

const ES: readonly TrustedCarrier[] = [
  C("Correos", "correos-es"),
  C("SEUR", "seur"),
  C("MRW", "mrw-spain"),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const IT: readonly TrustedCarrier[] = [
  C("Poste Italiane", "poste-italiane"),
  C("BRT", "brt-it"),
  C("GLS Italy", "gls-italy"),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const GB: readonly TrustedCarrier[] = [
  C("Royal Mail", "royal-mail"),
  C("Evri", "myhermes-uk"),
  C("DPD UK", "dpd-uk"),
  C("UPS", "ups"),
  C("DHL", "dhl"),
]

const US: readonly TrustedCarrier[] = [
  C("USPS", "usps"),
  C("UPS", "ups"),
  C("FedEx", "fedex"),
  C("DHL", "dhl"),
]

const CA: readonly TrustedCarrier[] = [
  C("Canada Post", "canada-post"),
  C("UPS", "ups"),
  C("FedEx", "fedex"),
  C("DHL", "dhl"),
]

const PL: readonly TrustedCarrier[] = [
  C("InPost", "inpost-paczkomaty"),
  C("DPD Poland", "dpd"),
  C("Poczta Polska", "poczta-polska"),
  C("DHL", "dhl"),
]

const PT: readonly TrustedCarrier[] = [
  C("CTT", "ctt-portugal"),
  C("DPD", "dpd"),
  C("UPS", "ups"),
  C("DHL", "dhl"),
]

const AT: readonly TrustedCarrier[] = [
  C("Österreichische Post", "austrian-post"),
  C("DPD", "dpd"),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const CH: readonly TrustedCarrier[] = [
  C("Swiss Post", "swiss-post"),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const EU_DEFAULT: readonly TrustedCarrier[] = [
  C("DHL", "dhl"),
  C("UPS", "ups"),
  C("FedEx", "fedex"),
  C("DPD", "dpd"),
]

export const TRUSTED_CARRIERS_BY_COUNTRY: Record<string, readonly TrustedCarrier[]> = {
  FR,
  DE,
  BE,
  NL,
  ES,
  IT,
  GB,
  US,
  CA,
  PL,
  PT,
  AT,
  CH,
  LU: FR,
  MC: FR,
  IE: GB,
  NO: EU_DEFAULT,
  SE: EU_DEFAULT,
  DK: EU_DEFAULT,
  FI: EU_DEFAULT,
}

export function normalizeShippingCountryIso2(raw: string | null | undefined): string {
  const code = typeof raw === "string" ? raw.trim().toUpperCase().slice(0, 2) : ""
  return code.length === 2 ? code : "FR"
}

export function extractShippingCountryIso2FromAddress(shippingAddress: unknown): string {
  if (!shippingAddress || typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
    return "FR"
  }
  const o = shippingAddress as Record<string, unknown>
  const country =
    typeof o.country === "string"
      ? o.country
      : typeof o.countryCode === "string"
        ? o.countryCode
        : ""
  return normalizeShippingCountryIso2(country)
}

export function trustedCarriersForCountry(
  countryIso2: string | null | undefined,
  policy?: ShipTrackingPolicy
): readonly TrustedCarrier[] {
  const resolved = policy ?? resolveShipTrackingPolicy()
  const code = normalizeShippingCountryIso2(countryIso2)
  const base = TRUSTED_CARRIERS_BY_COUNTRY[code] ?? EU_DEFAULT
  if (!resolved.otherCarrierAllowed) return base
  return [...base, C(OTHER_TRUSTED_CARRIER_LABEL, "")]
}

export function trustedCarrierLabelsForCountry(
  countryIso2: string | null | undefined,
  policy?: ShipTrackingPolicy
): string[] {
  return trustedCarriersForCountry(countryIso2, policy).map((row) => row.label)
}

export function isTrustedCarrierLabelForCountry(
  countryIso2: string | null | undefined,
  carrierLabel: string,
  policy?: ShipTrackingPolicy
): boolean {
  const label = carrierLabel.trim()
  if (!label) return false
  return trustedCarriersForCountry(countryIso2, policy).some((row) => row.label === label)
}

export function afterShipSlugForTrustedCarrier(label: string): string | undefined {
  const trimmed = label.trim()
  if (!trimmed || trimmed === OTHER_TRUSTED_CARRIER_LABEL) return undefined
  for (const carriers of Object.values(TRUSTED_CARRIERS_BY_COUNTRY)) {
    const hit = carriers.find((row) => row.label === trimmed)
    if (hit?.afterShipSlug) return hit.afterShipSlug
  }
  const other = EU_DEFAULT.find((row) => row.label === trimmed)
  if (other?.afterShipSlug) return other.afterShipSlug
  if (trimmed === OTHER_TRUSTED_CARRIER_LABEL) return undefined
  return undefined
}

export function defaultTrustedCarrierLabel(countryIso2: string | null | undefined): string {
  return trustedCarriersForCountry(countryIso2)[0]?.label ?? "DHL"
}
