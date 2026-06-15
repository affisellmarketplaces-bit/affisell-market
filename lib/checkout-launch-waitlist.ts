import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeLaunchWaitlistEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase().slice(0, 254)
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export type JoinLaunchWaitlistInput = {
  email: string
  countryIso2: string
  marketRegion?: MarketRegion
  locale?: string | null
}

export type JoinLaunchWaitlistResult =
  | { ok: true; created: boolean }
  | { ok: false; error: "invalid_email" | "invalid_country" | "already_available" }

export function validateJoinLaunchWaitlist(input: JoinLaunchWaitlistInput): JoinLaunchWaitlistResult | null {
  const email = normalizeLaunchWaitlistEmail(input.email)
  const country = normalizeVisitorCountryIso2(input.countryIso2)

  if (!email) return { ok: false, error: "invalid_email" }
  if (!country) return { ok: false, error: "invalid_country" }

  return null
}

export function joinLaunchWaitlistPayload(input: JoinLaunchWaitlistInput): {
  email: string
  countryIso2: string
  marketRegion: MarketRegion
  locale: string | null
} | null {
  const blocked = validateJoinLaunchWaitlist(input)
  if (blocked) return null

  const email = normalizeLaunchWaitlistEmail(input.email)!
  const countryIso2 = normalizeVisitorCountryIso2(input.countryIso2)!
  const marketRegion = input.marketRegion ?? MARKET_REGION
  const locale =
    typeof input.locale === "string" && input.locale.trim() ? input.locale.trim().slice(0, 8) : null

  return { email, countryIso2, marketRegion, locale }
}
