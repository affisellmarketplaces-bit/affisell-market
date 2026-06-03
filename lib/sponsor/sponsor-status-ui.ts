import type { SponsorPlacement } from "@/lib/sponsor/sponsor-constants"

export type SponsorCampaignStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELLED"
  | string

export function sponsorStatusTone(
  status: SponsorCampaignStatus
): "amber" | "emerald" | "zinc" | "rose" {
  switch (status) {
    case "PENDING_PAYMENT":
      return "amber"
    case "ACTIVE":
      return "emerald"
    case "EXPIRED":
      return "zinc"
    case "CANCELLED":
      return "rose"
    default:
      return "zinc"
  }
}

export function isSponsorPlacement(placement: string): placement is SponsorPlacement {
  return placement === "HOME_SPOTLIGHT" || placement === "CATEGORY_TOP" || placement === "SEARCH_BOOST"
}
