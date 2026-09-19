/** Static copy — buyer premium home (audit mockup). Product tiles loaded server-side. */

export type BuyerDiscoverIcon = "trending" | "sparkles" | "shield" | "stars"

export type BuyerDiscoverImage = {
  src: string
  alt: string
  href: string
}

export type BuyerDiscoverCard = {
  id: string
  /** Key under `homeDiscover.title.*` (translated at render — this payload is cached, locale-agnostic). */
  titleKey: string
  /** Key under `homeDiscover.subtitle.*` + ICU values. */
  subtitleKey: string
  subtitleValues?: Record<string, string | number>
  icon: BuyerDiscoverIcon
  images: BuyerDiscoverImage[]
  href: string
}

export type BuyerDiscoverCardMeta = {
  id: BuyerDiscoverCard["id"]
  titleKey: string
  icon: BuyerDiscoverIcon
  href: string
}

/** Card chrome from mockup — images + subtitles filled from live catalog. */
export const BUYER_DISCOVER_CARD_META: BuyerDiscoverCardMeta[] = [
  {
    id: "trending",
    titleKey: "trending",
    icon: "trending",
    href: "/#explorer",
  },
  {
    id: "recommended",
    titleKey: "recommended",
    icon: "sparkles",
    href: "/discover",
  },
  {
    id: "trusted",
    titleKey: "trusted",
    icon: "shield",
    href: "/shops",
  },
  {
    id: "new",
    titleKey: "new",
    icon: "stars",
    href: "/#explorer",
  },
]

export const BUYER_PREMIUM_TRUST_PILLS = [
  "Verified stores",
  "Protected payments",
  "14-day EU returns",
] as const
