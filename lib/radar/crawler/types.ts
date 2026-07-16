export interface GlobalProduct {
  marketplaceId: string
  externalId: string
  title: string
  price: number
  currency: string
  rank: number | null
  category: string | null
  country: string
  salesEst: number | null
  imageUrl: string | null
  url: string | null
  crawledAt: Date
}

export const RADAR_SCAN_CATEGORIES = ["electronics", "fashion", "beauty", "home"] as const

export type RadarScanCategory = (typeof RADAR_SCAN_CATEGORIES)[number]

export interface TrendingKeyword {
  keyword: string
  volume: number
  growth: number
}
