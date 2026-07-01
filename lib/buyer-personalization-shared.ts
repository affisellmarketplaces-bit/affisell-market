import type { BuyerListingCard } from "@/lib/buyer-discovery-types"

export type BuyerPersonalizationSource = "wishlist" | "orders" | "browse"

export type BuyerPersonalizedPicksPayload = {
  items: BuyerListingCard[]
  /** True when picks are driven by wishlist, orders, or browse — not pure bestseller fallback. */
  personalized: boolean
}
