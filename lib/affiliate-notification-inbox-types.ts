/** Client-safe affiliate alerts inbox — no server imports. */

import type { MerchantNotificationOrderSummary } from "@/lib/merchant-notification-order-summary-types"

export type AffiliateNotificationBreakdown = {
  netEarnings?: string
  commission?: string
  markup?: string
  affisellFee?: string
  earningsBase?: string
  clientTotal?: string
  clientHt?: string
  clientVat?: string
  lineHt?: string
}

export type AffiliateNotificationInboxRow = {
  id: string
  type: string
  message: string
  imageUrl: string | null
  orderId: string | null
  read: boolean
  createdAt: string
  breakdown?: AffiliateNotificationBreakdown
  order?: MerchantNotificationOrderSummary
}

export type AffiliateNotificationInboxPayload = {
  unreadCount: number
  notifications: AffiliateNotificationInboxRow[]
}
