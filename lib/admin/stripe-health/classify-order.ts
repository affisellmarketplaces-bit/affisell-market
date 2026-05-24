import { parseWebhookErrorMessage } from "@/lib/admin/stripe-health/parse-webhook-error"
import type { StripeHealthFailureDetail, StripeHealthStatus } from "@/lib/admin/stripe-health/types"

export type StripeHealthOrderInput = {
  splitStatus?: string
  status: string
  paymentSettlementStatus: string
  supplierPayoutCents: number | null
  affiliatePayoutCents: number | null
  supplierOnboarded: boolean
  affiliateOnboarded: boolean
  affiliateStripeAccountId: string | null
}

export type StripeHealthWebhookInput = {
  status: string
  error: string | null
} | null

export function isOrderSplitSettled(order: StripeHealthOrderInput): boolean {
  if (order.paymentSettlementStatus === "SETTLED") return true
  return (order.supplierPayoutCents ?? 0) > 0 && (order.affiliatePayoutCents ?? 0) > 0
}

export function classifyStripeHealthOrder(
  order: StripeHealthOrderInput,
  webhook: StripeHealthWebhookInput
): StripeHealthStatus {
  if (order.splitStatus === "SUCCESS") return "split_ok"
  if (order.splitStatus === "PARTIAL") return "onboarding_required"
  if (order.splitStatus === "FAILED") return "split_failed"
  if (isOrderSplitSettled(order)) return "split_ok"

  const webhookFailed = webhook?.status === "failed"
  const parsed = parseWebhookErrorMessage(webhook?.error)
  const onboardingError =
    parsed.errorCode === "affiliate_onboarding_required" ||
    parsed.errorCode === "insufficient_capabilities_for_transfer" ||
    Boolean(webhook?.error?.includes("AFFILIATE_ONBOARDING_REQUIRED"))

  if (webhookFailed && onboardingError) return "onboarding_required"
  if (webhookFailed) return "split_failed"

  const needsOnboarding =
    (order.status === "paid" || order.paymentSettlementStatus === "PAID") &&
    (!order.supplierOnboarded || !order.affiliateOnboarded)

  if (needsOnboarding) return "onboarding_required"

  if (order.status === "paid" || order.paymentSettlementStatus === "PAID") return "paid"

  return "paid"
}

export function buildFailureDetail(webhook: StripeHealthWebhookInput): StripeHealthFailureDetail | null {
  if (!webhook || webhook.status !== "failed") return null
  const parsed = parseWebhookErrorMessage(webhook.error)
  return {
    errorCode: parsed.errorCode,
    accountId: parsed.accountId,
    stripeDashboardUrl: parsed.stripeDashboardUrl,
    rawError: webhook.error,
  }
}
