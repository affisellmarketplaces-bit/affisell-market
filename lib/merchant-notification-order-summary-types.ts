/** Client-safe: what an alert shows about the order/product behind it. */
export type MerchantNotificationOrderSummary = {
  productName: string
  imageUrl: string | null
  quantity: number
  variantLabel: string | null
  totalCents: number
  status: string
  /** Short human reference (last 6 chars of the order id). */
  ref: string
}
