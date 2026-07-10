/** Client-safe supplier dashboard analytics payload. */

export type SupplierDailyRevenuePoint = {
  day: string
  revenueCents: number
  orders: number
}

export type SupplierTopAffiliateRow = {
  affiliateId: string
  displayName: string
  revenueCents: number
  orders: number
}

export type SupplierSkuPerformanceRow = {
  productId: string
  productName: string
  views: number
  clicks: number
  conversionRatePct: number
  epcCents: number
  orders: number
  revenueCents: number
}

export type SupplierDashboardAnalytics = {
  dailyRevenue: SupplierDailyRevenuePoint[]
  topAffiliates: SupplierTopAffiliateRow[]
  skuPerformance: SupplierSkuPerformanceRow[]
  totalRevenue30dCents: number
  returnRatePct: number
  netMarginCents: number
  stripeFeesCents: number
  chargebackCents: number
  estimatedNextPayoutCents: number
  estimatedNextPayoutDate: string | null
  zeroSalesAlert: boolean
}
