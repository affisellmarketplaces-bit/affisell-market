/**
 * Affisell ↔ AliExpress DS address / country mapping.
 * Never log full street address — city + zip only in business logs.
 */

export type AffisellShippingAddressInput = {
  name?: string | null
  phone?: string | null
  email?: string | null
  address1?: string | null
  address2?: string | null
  /** Stripe-style aliases */
  line1?: string | null
  line2?: string | null
  city?: string | null
  zip?: string | null
  postal_code?: string | null
  postalCode?: string | null
  countryCode?: string | null
  country?: string | null
  state?: string | null
  province?: string | null
}

/** AliExpress logistics_address shape (DS order.create). */
export type AliExpressLogisticsAddress = {
  contact_person: string
  full_address: string
  /** Legacy alias some AE endpoints still expect */
  address: string
  city: string
  province: string
  zip: string
  country: string
  mobile_no: string
  phone_country: string
  /** Optional — some DS builds accept CPF / tax id */
  locale_name?: string
}

/** ISO2 → ITU dialing code (no +). */
const PHONE_COUNTRY_BY_ISO: Record<string, string> = {
  FR: "33",
  BE: "32",
  CH: "41",
  LU: "352",
  DE: "49",
  ES: "34",
  IT: "39",
  NL: "31",
  PT: "351",
  AT: "43",
  PL: "48",
  GB: "44",
  UK: "44",
  IE: "353",
  US: "1",
  CA: "1",
  CN: "86",
  JP: "81",
  KR: "82",
  AU: "61",
  BR: "55",
  MX: "52",
}

const COUNTRY_ALIASES: Record<string, string> = {
  FRANCE: "FR",
  "UNITED STATES": "US",
  USA: "US",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  BELGIUM: "BE",
  SWITZERLAND: "CH",
  GERMANY: "DE",
  SPAIN: "ES",
  ITALY: "IT",
  NETHERLANDS: "NL",
  PORTUGAL: "PT",
  AUSTRIA: "AT",
  POLAND: "PL",
  IRELAND: "IE",
  CANADA: "CA",
  CHINA: "CN",
  JAPAN: "JP",
}

/** Normalize to ISO-3166 alpha-2 (default FR). */
export function mapCountryCode(raw: string | null | undefined): string {
  const t = (raw ?? "").trim()
  if (!t) return "FR"
  const upper = t.toUpperCase()
  if (COUNTRY_ALIASES[upper]) return COUNTRY_ALIASES[upper]!
  if (t.length === 2) return upper
  return t.slice(0, 2).toUpperCase()
}

export function mapPhoneCountry(countryCode: string): string {
  const iso = mapCountryCode(countryCode)
  return PHONE_COUNTRY_BY_ISO[iso] ?? "33"
}

/** Strip non-digits; drop leading 0 / country dial code when present. */
export function normalizeMobileNo(phone: string | null | undefined, countryCode: string): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (!digits) return ""
  const dial = mapPhoneCountry(countryCode)
  if (digits.startsWith(dial) && digits.length > dial.length + 4) {
    return digits.slice(dial.length)
  }
  if (digits.startsWith("0") && digits.length > 1) {
    return digits.slice(1)
  }
  return digits
}

function pickLine1(addr: AffisellShippingAddressInput): string {
  return (addr.address1 ?? addr.line1 ?? "").trim()
}

function pickLine2(addr: AffisellShippingAddressInput): string {
  return (addr.address2 ?? addr.line2 ?? "").trim()
}

function pickZip(addr: AffisellShippingAddressInput): string {
  return (addr.zip ?? addr.postal_code ?? addr.postalCode ?? "").trim()
}

/**
 * Map Affisell / Stripe checkout address → AliExpress logistics_address fields.
 * Throws if required fields are missing (fail before paying AE).
 */
export function mapAffisellAddressToAliExpress(
  address: AffisellShippingAddressInput
): AliExpressLogisticsAddress {
  const country = mapCountryCode(address.countryCode ?? address.country)
  const city = (address.city ?? "").trim()
  const zip = pickZip(address)
  const line1 = pickLine1(address)
  const line2 = pickLine2(address)
  const fullAddress = [line1, line2].filter(Boolean).join(", ").trim()
  const contact = (address.name ?? "").trim() || "Customer"
  const province = (address.state ?? address.province ?? (city || country)).trim()
  const mobile = normalizeMobileNo(address.phone, country)

  const missing: string[] = []
  if (!fullAddress) missing.push("address1")
  if (!city) missing.push("city")
  if (!zip) missing.push("zip")
  if (!mobile) missing.push("phone")
  if (missing.length > 0) {
    throw new AliExpressAddressError(`missing_required_fields:${missing.join(",")}`)
  }

  return {
    contact_person: contact.slice(0, 128),
    full_address: fullAddress.slice(0, 512),
    address: fullAddress.slice(0, 512),
    city: city.slice(0, 128),
    province: province.slice(0, 128),
    zip: zip.slice(0, 32),
    country,
    mobile_no: mobile.slice(0, 32),
    phone_country: mapPhoneCountry(country),
  }
}

export class AliExpressAddressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AliExpressAddressError"
  }
}

/** Safe log fragment — never include street / phone / name. */
export function summarizeAddressForLog(address: AffisellShippingAddressInput | AliExpressLogisticsAddress): {
  city: string
  zip: string
  country: string
} {
  if ("full_address" in address || "mobile_no" in address) {
    const a = address as AliExpressLogisticsAddress
    return { city: a.city, zip: a.zip, country: a.country }
  }
  return {
    city: (address.city ?? "").trim() || "(unknown)",
    zip: pickZip(address) || "(unknown)",
    country: mapCountryCode(address.countryCode ?? address.country),
  }
}
