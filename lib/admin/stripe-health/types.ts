export const STRIPE_HEALTH_STATUSES = [
  "paid",
  "split_ok",
  "split_failed",
  "onboarding_required",
] as const

export type StripeHealthStatus = (typeof STRIPE_HEALTH_STATUSES)[number]

export type StripeHealthFailureDetail = {
  errorCode: string | null
  accountId: string | null
  stripeDashboardUrl: string | null
  rawError: string | null
}

export type StripeHealthOrderRow = {
  id: string
  orderNumber: string
  customerEmail: string
  totalCents: number
  createdAt: string
  stripeHealthStatus: StripeHealthStatus
  paymentSettlementStatus: string
  supplierAccountId: string | null
  affiliateAccountId: string | null
  supplierOnboarded: boolean
  affiliateOnboarded: boolean
  webhookEventId: string | null
  webhookStatus: string | null
  failure: StripeHealthFailureDetail | null
}
