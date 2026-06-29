import { EU_MEMBER_ISO2, type EuMemberIso2 } from "@/lib/eu-market-countries"

/**
 * Standard VAT rates (B2C, goods) — EU member states.
 * Source: national standard rates; verify before filing (rates may change).
 */
export const EU_STANDARD_VAT_AS_OF = "2026-01-01"

export const EU_STANDARD_VAT_RATES: Record<EuMemberIso2, number> = {
  AT: 20,
  BE: 21,
  BG: 20,
  HR: 25,
  CY: 19,
  CZ: 21,
  DK: 25,
  EE: 22,
  FI: 25.5,
  FR: 20,
  DE: 19,
  GR: 24,
  HU: 27,
  IE: 23,
  IT: 22,
  LV: 21,
  LT: 21,
  LU: 17,
  MT: 18,
  NL: 21,
  PL: 23,
  PT: 23,
  RO: 19,
  SK: 23,
  SI: 22,
  ES: 21,
  SE: 25,
}

export function euStandardVatRows(locale: string): { code: EuMemberIso2; country: string; rate: number }[] {
  const dn = new Intl.DisplayNames([locale], { type: "region" })
  return EU_MEMBER_ISO2.map((code) => ({
    code,
    country: dn.of(code) ?? code,
    rate: EU_STANDARD_VAT_RATES[code],
  }))
}

export function formatVatRatePercent(rate: number, locale: string): string {
  return `${rate.toLocaleString(locale, { maximumFractionDigits: 1 })} %`
}
