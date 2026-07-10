/** Client-safe analytics payload for affiliate dashboard charts. */

export type AffiliateDailyRevenuePoint = {
  day: string
  revenueCents: number
  orders: number
}

export type AffiliateTopProductEpc = {
  affiliateProductId: string
  productName: string
  epcCents: number
  clicks: number
  orders: number
  earningsCents: number
}

export type AffiliateDashboardAnalytics = {
  dailyRevenue: AffiliateDailyRevenuePoint[]
  topProductsEpc: AffiliateTopProductEpc[]
  estimatedPayoutJ7Cents: number
  totalRevenue30dCents: number
}
