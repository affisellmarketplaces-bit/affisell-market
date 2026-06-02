export const SPONSOR_FLOW_METADATA = "sponsor_campaign" as const

export const SPONSOR_MIN_RATE_BPS = 300
export const SPONSOR_MAX_RATE_BPS = 1500
export const SPONSOR_DEFAULT_RATE_BPS = 500

export const SPONSOR_DURATIONS_DAYS = [7, 14, 30] as const
export type SponsorDurationDays = (typeof SPONSOR_DURATIONS_DAYS)[number]

export const SPONSOR_PLACEMENTS = [
  "HOME_SPOTLIGHT",
  "CATEGORY_TOP",
  "SEARCH_BOOST",
] as const
export type SponsorPlacement = (typeof SPONSOR_PLACEMENTS)[number]

export const SPONSOR_PLACEMENT_LABELS: Record<SponsorPlacement, string> = {
  HOME_SPOTLIGHT: "Spotlight Accueil",
  CATEGORY_TOP: "Top Catégorie",
  SEARCH_BOOST: "Boost Recherche",
}

export const SPONSOR_PLACEMENT_FEE_MULTIPLIER: Record<SponsorPlacement, number> = {
  HOME_SPOTLIGHT: 1.5,
  CATEGORY_TOP: 1.2,
  SEARCH_BOOST: 1,
}

export const SPONSOR_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const
