/**
 * "Established in the Union" for GPSR purposes. Deliberately EU-27 only: EEA/EFTA, the UK and Switzerland are third
 * countries for an economic operator's establishment unless counsel says otherwise (conservative = asks for an EU
 * responsible person, never skips it). Client-safe.
 */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
])

export function normalizeCountryCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function isCountryCode(raw: string): boolean {
  return /^[A-Z]{2}$/.test(normalizeCountryCode(raw))
}

export function isEuCountry(raw: string): boolean {
  return EU_COUNTRY_CODES.has(normalizeCountryCode(raw))
}
