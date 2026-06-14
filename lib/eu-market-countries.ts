import type { Prisma } from "@prisma/client"

import { MARKET_REGION } from "@/lib/market-config"

/** EU member states (ISO 3166-1 alpha-2) — 27 countries. */
export const EU_MEMBER_ISO2 = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const

export type EuMemberIso2 = (typeof EU_MEMBER_ISO2)[number]

/** EEA + key neighbours — enabled at Stripe Checkout when region is EU. */
export const EU_CHECKOUT_EXTRA_ISO2 = ["GB", "CH", "NO", "IS", "LI"] as const

export type EuCheckoutExtraIso2 = (typeof EU_CHECKOUT_EXTRA_ISO2)[number]

export type EuCheckoutIso2 = EuMemberIso2 | EuCheckoutExtraIso2

/** @deprecated Prefer {@link EU_MEMBER_ISO2} or {@link EU_MEMBER_SET}. */
export const EU_COUNTRIES = new Set<string>(EU_MEMBER_ISO2)

export const EU_MEMBER_SET = EU_COUNTRIES

const EU_MEMBER_LIST: readonly string[] = EU_MEMBER_ISO2

export function isEuMemberCountry(code: string | null | undefined): boolean {
  if (!code) return false
  return EU_MEMBER_SET.has(code.trim().toUpperCase().slice(0, 2))
}

/** Sorted ISO2 list for Stripe `shipping_address_collection.allowed_countries`. */
export function stripeCheckoutAllowedCountries(): EuCheckoutIso2[] | ("US" | "CA")[] {
  if (MARKET_REGION === "us") {
    return ["US", "CA"]
  }
  const merged = [...EU_MEMBER_ISO2, ...EU_CHECKOUT_EXTRA_ISO2]
  return [...new Set(merged)].sort() as EuCheckoutIso2[]
}

const CHECKOUT_ALLOWED_COUNTRY_SET = new Set<string>(
  stripeCheckoutAllowedCountries().map((c) => c.toUpperCase())
)

/** Whether Stripe Checkout accepts shipping to this ISO-2 country in the current market region. */
export function isStripeCheckoutCountry(code: string | null | undefined): boolean {
  const normalized = typeof code === "string" ? code.trim().toUpperCase().slice(0, 2) : ""
  if (normalized.length !== 2) return false
  return CHECKOUT_ALLOWED_COUNTRY_SET.has(normalized)
}

/** Product filter: ships from EU (member warehouse, regional hub, or explicit EU label). */
export function prismaProductShipsFromEuWhere(): Prisma.ProductWhereInput {
  return {
    OR: [
      { shippingCountry: { in: [...EU_MEMBER_ISO2] } },
      { warehouseType: "regional" },
      { shipsFrom: { equals: "EU", mode: "insensitive" } },
    ],
  }
}

export const EU_MEMBER_COUNT = EU_MEMBER_ISO2.length

export const EU_CHECKOUT_COUNTRY_COUNT = stripeCheckoutAllowedCountries().length
