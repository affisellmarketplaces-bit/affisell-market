/** Client-safe: what an alert shows about the order/product behind it. */
export type MerchantNotificationOrderSummary = {
  productName: string
  imageUrl: string | null
  quantity: number
  variantLabel: string | null
  /** Buyer-paid amount — ONLY for the affiliate/reseller who set that price; always null for suppliers. */
  totalCents: number | null
  status: string
  /** Short human reference (last 6 chars of the order id). */
  ref: string
}
