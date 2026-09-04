/** Static copy — buyer premium home (audit mockup). Product tiles loaded server-side. */

export type BuyerDiscoverIcon = "trending" | "sparkles" | "shield" | "stars"

export type BuyerDiscoverImage = {
  src: string
  alt: string
  href: string
}

export type BuyerDiscoverCard = {
  id: string
  title: string
  subtitle: string
  icon: BuyerDiscoverIcon
  images: BuyerDiscoverImage[]
  href: string
}

export type BuyerDiscoverCardMeta = {
  id: BuyerDiscoverCard["id"]
  title: string
  icon: BuyerDiscoverIcon
  href: string
}

/** Card chrome from mockup — images + subtitles filled from live catalog. */
export const BUYER_DISCOVER_CARD_META: BuyerDiscoverCardMeta[] = [
  {
    id: "trending",
    title: "Trending now",
    icon: "trending",
    href: "/#explorer",
  },
  {
    id: "recommended",
    title: "Recommended for you",
    icon: "sparkles",
    href: "/discover",
  },
  {
    id: "trusted",
    title: "From trusted stores",
    icon: "shield",
    href: "/shops",
  },
  {
    id: "new",
    title: "New arrivals",
    icon: "stars",
    href: "/#explorer",
  },
]

export const BUYER_PREMIUM_TRUST_PILLS = [
  "Verified stores",
  "Protected payments",
  "14-day EU returns",
] as const
