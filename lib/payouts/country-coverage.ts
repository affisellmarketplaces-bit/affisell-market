/**
 * Which payout rails a reseller can realistically use from their country — client-safe (no Prisma).
 * PayPal / Wise / Payoneer are treated as available everywhere (each provider handles its own
 * country eligibility on sign-up); BANK and the mobile-money rails are gated to where the rail
 * genuinely exists, so the add-payout flow only ever offers options that will actually work.
 *
 * Coverage lists are a deliberate, documented best effort (public, well-known footprints of each
 * network) — adjust here as Affisell's real reseller base and operational coverage evolve. Being
 * wrong here only hides/shows a UI option; it never touches money (payouts are reconciled by ops,
 * not auto-routed), so a generous list is low-risk.
 */
import type { PayoutMethodType } from "@prisma/client"

import { EUROPE_COUNTRY_CODES } from "@/lib/shipping/carriers-europe"
import { EU_MEMBER_ISO2, EU_CHECKOUT_EXTRA_ISO2 } from "@/lib/eu-market-countries"
import { WORLD_RADAR_COUNTRIES } from "@/lib/radar/world-countries"

export type PayoutContinent = "Europe" | "Africa" | "Americas" | "Asia" | "Oceania" | "Middle East"

/** SEPA scheme membership — where an IBAN + BIC transfer actually clears. */
export const SEPA_IBAN_COUNTRIES: ReadonlySet<string> = new Set([
  ...EU_MEMBER_ISO2,
  ...EU_CHECKOUT_EXTRA_ISO2,
  "MC",
  "SM",
  "AD",
  "VA",
])

/** Wave mobile money — Francophone West Africa + Uganda. */
export const WAVE_COUNTRIES: ReadonlySet<string> = new Set(["SN", "CI", "ML", "BF", "UG"])

/** Orange Money — Orange Group's African/Middle-East footprint. */
export const ORANGE_MONEY_COUNTRIES: ReadonlySet<string> = new Set([
  "SN", "CI", "ML", "BF", "GN", "CM", "NE", "GW", "BW", "MG", "CD", "EG", "JO", "TN", "SL", "LR", "MA",
])

/** MTN Mobile Money (MoMo) — MTN Group's footprint. */
export const MTN_MOMO_COUNTRIES: ReadonlySet<string> = new Set([
  "GH", "UG", "RW", "CM", "CI", "BJ", "CG", "GN", "GW", "LR", "SS", "SZ", "ZM", "NG",
])

/** Real ITU dial codes for every country any mobile-money rail above covers. */
export const MOBILE_MONEY_DIAL_CODE: Readonly<Record<string, string>> = {
  SN: "+221", CI: "+225", ML: "+223", BF: "+226", UG: "+256", GH: "+233", RW: "+250",
  CM: "+237", BJ: "+229", CG: "+242", GN: "+224", GW: "+245", LR: "+231", SS: "+211",
  SZ: "+268", ZM: "+260", NG: "+234", EG: "+20", JO: "+962", TN: "+216", SL: "+232",
  BW: "+267", MG: "+261", CD: "+243", NE: "+227", MA: "+212",
}

function region(code: string): PayoutContinent {
  if (SEPA_IBAN_COUNTRIES.has(code) || (EUROPE_COUNTRY_CODES as readonly string[]).includes(code)) {
    return "Europe"
  }
  if (["AE", "SA", "JO", "IL", "TR", "QA", "KW", "BH", "OM"].includes(code)) return "Middle East"
  if (["US", "CA", "MX", "BR", "AR", "CO", "CL", "PE"].includes(code)) return "Americas"
  if (["JP", "KR", "IN", "ID", "VN", "SG", "CN", "PH", "TH", "MY", "PK", "BD"].includes(code)) return "Asia"
  if (["AU", "NZ"].includes(code)) return "Oceania"
  return "Africa"
}

/** Every country the add-payout picker offers by default (searchable; "other" free-text covers the rest). */
export const PAYOUT_COUNTRY_CODES: readonly string[] = Array.from(
  new Set<string>([
    ...EUROPE_COUNTRY_CODES,
    ...SEPA_IBAN_COUNTRIES,
    ...WAVE_COUNTRIES,
    ...ORANGE_MONEY_COUNTRIES,
    ...MTN_MOMO_COUNTRIES,
    ...WORLD_RADAR_COUNTRIES.filter((c) => c.code !== "UK").map((c) => c.code),
    "GB",
  ])
).sort()

export type PayoutCountryOption = { code: string; continent: PayoutContinent }

export const PAYOUT_COUNTRY_OPTIONS: readonly PayoutCountryOption[] = PAYOUT_COUNTRY_CODES.map((code) => ({
  code,
  continent: region(code),
}))

/** Payout rails that genuinely work from this country, PayPal/Wise/Payoneer first (always available). */
export function payoutMethodsForCountry(countryCode: string): PayoutMethodType[] {
  const code = countryCode.trim().toUpperCase()
  const methods: PayoutMethodType[] = ["PAYPAL", "WISE", "PAYONEER"]
  if (SEPA_IBAN_COUNTRIES.has(code)) methods.unshift("BANK")
  if (WAVE_COUNTRIES.has(code)) methods.push("MOBILE_MONEY_WAVE")
  if (ORANGE_MONEY_COUNTRIES.has(code)) methods.push("MOBILE_MONEY_ORANGE")
  if (MTN_MOMO_COUNTRIES.has(code)) methods.push("MOBILE_MONEY_MTN")
  return methods
}

export function isPayoutMethodAvailableForCountry(type: PayoutMethodType, countryCode: string): boolean {
  return payoutMethodsForCountry(countryCode).includes(type)
}

/** Dial code to pre-fill the phone field once a mobile-money-eligible country is picked. */
export function dialCodeForCountry(countryCode: string): string | null {
  return MOBILE_MONEY_DIAL_CODE[countryCode.trim().toUpperCase()] ?? null
}

/** `code.toUpperCase()` → flag emoji via Unicode regional-indicator symbols — correct for any ISO2. */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️"
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
}
