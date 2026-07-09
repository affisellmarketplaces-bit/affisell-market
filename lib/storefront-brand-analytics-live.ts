/** Live growth coaching for Brand Studio analytics, client-safe. */

export type BrandAnalyticsLiveInput = {
  liveCatalogCount: number
  totalListingClicks: number
  totalListingConversions: number
}

export type BrandAnalyticsStage =
  | "publish_first_listing"
  | "drive_first_visit"
  | "traffic_no_sales"
  | "first_sales"

export function resolveBrandAnalyticsStage(input: BrandAnalyticsLiveInput): BrandAnalyticsStage {
  if (input.liveCatalogCount <= 0) return "publish_first_listing"
  if (input.totalListingClicks <= 0) return "drive_first_visit"
  if (input.totalListingConversions <= 0) return "traffic_no_sales"
  return "first_sales"
}
