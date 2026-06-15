import type { ExpansionCountryFunnel, ExpansionFunnelSummary } from "@/lib/admin/load-admin-expansion-funnel"
import type { ExpansionRolloutHealthStats } from "@/lib/admin/load-expansion-rollout-health"
import type { MarketRegion } from "@/lib/market-config"

export type ExpansionCountryRow = {
  countryIso2: string
  waitlistCount: number
  pendingNotifyCount: number
  enabled: boolean
  openedAt: string | null
  launchEmailSentAt: string | null
  firstOrderAt: string | null
  firstOrderId: string | null
  graduatedAt: string | null
  graduationEmailSentAt: string | null
  launchBounceRetriesPending: number
  launchBounceSuppressed: number
  launchBounceRatePct: number
  funnel: ExpansionCountryFunnel
}

export type ExpansionNextPilot = {
  rank: number
  countryIso2: string
  waitlistCount: number
}

export type GraduatedThisMonthCountry = {
  countryIso2: string
  graduatedAt: string
}

export type ExpansionEmailBounceOverview = {
  bouncesThisMonth: number
  complaintsThisMonth: number
  launchRetriesPending: number
  launchSuppressedTotal: number
}

export type AdminExpansionOverview = {
  marketRegion: MarketRegion
  liveCheckoutCount: number
  rolloutCount: number
  graduatedCount: number
  graduatedThisMonth: number
  graduatedThisMonthCountries: GraduatedThisMonthCountry[]
  emailBounces: ExpansionEmailBounceOverview
  totalWaitlist: number
  funnel: ExpansionFunnelSummary
  nextPilot: ExpansionNextPilot | null
  rolloutHealth: ExpansionRolloutHealthStats
  autoPilotEnabled: boolean
  countries: ExpansionCountryRow[]
}
