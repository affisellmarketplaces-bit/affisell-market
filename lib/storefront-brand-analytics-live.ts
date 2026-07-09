/** Live growth coaching for Brand Studio analytics, client-safe. */

export type BrandAnalyticsLiveInput = {
  liveCatalogCount: number
  totalListingClicks: number
  totalListingConversions: number
  embedEnabled?: boolean
}

export type BrandAnalyticsStage =
  | "publish_first_listing"
  | "drive_first_visit"
  | "traffic_no_sales"
  | "first_sales"
  | "scale_winning_channel"

export type BrandAnalyticsCoachTarget = "dashboard" | "share" | "pages" | "embed" | "amplify"

export function resolveBrandAnalyticsStage(input: BrandAnalyticsLiveInput): BrandAnalyticsStage {
  if (input.liveCatalogCount <= 0) return "publish_first_listing"
  if (input.totalListingClicks <= 0) return "drive_first_visit"
  if (input.totalListingConversions <= 0) return "traffic_no_sales"
  if (!input.embedEnabled) return "first_sales"
  return "scale_winning_channel"
}

export function resolveBrandAnalyticsCoachTarget(
  stage: BrandAnalyticsStage
): BrandAnalyticsCoachTarget {
  switch (stage) {
    case "publish_first_listing":
      return "dashboard"
    case "drive_first_visit":
      return "share"
    case "traffic_no_sales":
      return "pages"
    case "first_sales":
      return "embed"
    case "scale_winning_channel":
      return "amplify"
  }
}
