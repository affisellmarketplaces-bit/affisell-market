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
  C("Correos Express", ""),
  C("GLS Spain", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const IT: readonly TrustedCarrier[] = [
  C("Poste Italiane", "poste-italiane"),
  C("BRT", "brt-it"),
  C("GLS Italy", "gls-italy"),
  C("SDA", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const GB: readonly TrustedCarrier[] = [
  C("Royal Mail", "royal-mail"),
  C("Evri", "myhermes-uk"),
  C("DPD UK", "dpd-uk"),
  C("Yodel", ""),
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
  C("GLS Poland", ""),
  C("Orlen Paczka", ""),
  C("DHL", "dhl"),
]

const PT: readonly TrustedCarrier[] = [
  C("CTT Expresso", "ctt-portugal"),
  C("DPD", "dpd"),
  C("UPS", "ups"),
  C("DHL", "dhl"),
]

const AT: readonly TrustedCarrier[] = [
  C("Österreichische Post", "austrian-post"),
  C("DPD", "dpd"),
  C("GLS Austria", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const CH: readonly TrustedCarrier[] = [
  C("Swiss Post", "swiss-post"),
  C("Planzer", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const IE: readonly TrustedCarrier[] = [
  C("An Post", ""),
  C("DPD Ireland", "dpd"),
  C("Aramex Ireland (Fastway)", ""),
  C("UPS", "ups"),
  C("DHL", "dhl"),
]

const LU: readonly TrustedCarrier[] = [
  C("POST Luxembourg", ""),
  C("DPD Luxembourg", "dpd"),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const MC: readonly TrustedCarrier[] = [
  C("La Poste Monaco", ""),
  C("Colissimo", "colissimo"),
  C("Chronopost", "chronopost"),
  C("DHL", "dhl"),
]

const SE: readonly TrustedCarrier[] = [
  C("PostNord Sweden", ""),
  C("Budbee", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const DK: readonly TrustedCarrier[] = [
  C("PostNord Denmark", ""),
  C("GLS Denmark", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const NO: readonly TrustedCarrier[] = [
  C("Posten Norge", ""),
  C("Bring", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const FI: readonly TrustedCarrier[] = [
  C("Posti", ""),
  C("Matkahuolto", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const IS: readonly TrustedCarrier[] = [
  C("Pósturinn (Iceland Post)", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const LI: readonly TrustedCarrier[] = [
  C("Liechtensteinische Post", ""),
  C("Swiss Post", "swiss-post"),
  C("DHL", "dhl"),
]

const EE: readonly TrustedCarrier[] = [
  C("Omniva Estonia", ""),
  C("DPD Estonia", "dpd"),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const LV: readonly TrustedCarrier[] = [
  C("Latvijas Pasts", ""),
  C("Omniva Latvia", ""),
  C("DPD Latvija", "dpd"),
  C("DHL", "dhl"),
]

const LT: readonly TrustedCarrier[] = [
  C("Lietuvos paštas", ""),
  C("LP Express", ""),
  C("DPD Lietuva", "dpd"),
  C("DHL", "dhl"),
]

const CZ: readonly TrustedCarrier[] = [
  C("Česká pošta", ""),
  C("Zásilkovna (Packeta)", ""),
  C("PPL", ""),
  C("DPD", "dpd"),
  C("DHL", "dhl"),
]

const SK: readonly TrustedCarrier[] = [
  C("Slovenská pošta", ""),
  C("GLS Slovakia", ""),
  C("DPD Slovakia", "dpd"),
  C("DHL", "dhl"),
]

const HU: readonly TrustedCarrier[] = [
  C("Magyar Posta", ""),
  C("GLS Hungary", ""),
  C("Foxpost", ""),
  C("DPD Hungary", "dpd"),
  C("DHL", "dhl"),
]

const RO: readonly TrustedCarrier[] = [
  C("Poșta Română", ""),
  C("Fan Courier", ""),
  C("Sameday", ""),
  C("Cargus", ""),
  C("DHL", "dhl"),
]

const BG: readonly TrustedCarrier[] = [
  C("Bulgarian Posts", ""),
  C("Speedy", ""),
  C("Econt Express", ""),
  C("DHL", "dhl"),
]

const HR: readonly TrustedCarrier[] = [
  C("Hrvatska pošta", ""),
  C("GLS Croatia", ""),
  C("DPD Croatia", "dpd"),
  C("DHL", "dhl"),
]

const SI: readonly TrustedCarrier[] = [
  C("Pošta Slovenije", ""),
  C("GLS Slovenia", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const GR: readonly TrustedCarrier[] = [
  C("ELTA Hellenic Post", ""),
  C("ACS Courier", ""),
  C("Speedex", ""),
  C("Geniki Taxydromiki", ""),
  C("DHL", "dhl"),
]

const MT: readonly TrustedCarrier[] = [
  C("MaltaPost", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const CY: readonly TrustedCarrier[] = [
  C("Cyprus Post", ""),
  C("DHL", "dhl"),
  C("UPS", "ups"),
]

const EU_DEFAULT: readonly TrustedCarrier[] = [
  C("DHL", "dhl"),
  C("UPS", "ups"),
  C("FedEx", "fedex"),
  C("DPD", "dpd"),
]

/** Every EU27 + EEA/UK country — no destination falls back to the generic EU list any more. */
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
  IE,
  LU,
  MC,
  SE,
  DK,
  NO,
  FI,
  IS,
  LI,
  EE,
  LV,
  LT,
  CZ,
  SK,
  HU,
  RO,
  BG,
  HR,
  SI,
  GR,
  MT,
  CY,
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

/** Pan-European reach (same network everywhere) vs a national operator — display grouping only. */
const NETWORK_CARRIER_PATTERN = /^(DHL|UPS|FedEx|TNT)$|^(DPD|GLS)\b/i

export function isPanEuropeanCarrierLabel(label: string): boolean {
  return NETWORK_CARRIER_PATTERN.test(label.trim())
}

export type TrustedCarrierGroups = {
  national: readonly TrustedCarrier[]
  network: readonly TrustedCarrier[]
  other: readonly TrustedCarrier[]
}

/** Same carriers as `trustedCarriersForCountry`, split for a picker: national operators first. */
export function trustedCarrierGroupsForCountry(
  countryIso2: string | null | undefined,
  policy?: ShipTrackingPolicy
): TrustedCarrierGroups {
  const all = trustedCarriersForCountry(countryIso2, policy)
  const national: TrustedCarrier[] = []
  const network: TrustedCarrier[] = []
  const other: TrustedCarrier[] = []
  for (const row of all) {
    if (row.label === OTHER_TRUSTED_CARRIER_LABEL) other.push(row)
    else if (isPanEuropeanCarrierLabel(row.label)) network.push(row)
    else national.push(row)
  }
  return { national, network, other }
}
