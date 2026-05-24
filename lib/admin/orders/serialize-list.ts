import type { FulfillmentStatus, SplitStatus, TransferRole, TransferStatus } from "@prisma/client"

import { formatOrderNumber } from "@/lib/admin/orders/list-query"
import { stripeConnectDashboardUrl } from "@/lib/admin/stripe-health/stripe-dashboard-url"

type TransferAttemptRow = {
  role: TransferRole
  status: TransferStatus
  amountCents: number
  destination: string
  errorCode: string | null
}

type OrderWithLinks = {
  id: string
  customerEmail: string
  sellingPriceCents: number
  totalCents: number | null
  status: string
  splitStatus: SplitStatus
  fulfillmentStatus: FulfillmentStatus
  trackingNumber: string | null
  createdAt: Date
  supplierFulfillmentLinks: Array<{
    supplierFulfillmentOrder: {
      provider: { name: string }
    } | null
  }>
  transferAttempts: TransferAttemptRow[]
}

export type AdminOrderListRow = {
  id: string
  orderNumber: string
  customerEmail: string
  amountCents: number
  paymentStatus: string
  splitStatus: SplitStatus
  supplierTransfer: { amountCents: number; status: TransferStatus; errorCode: string | null } | null
  affiliateTransfer: {
    amountCents: number
    status: TransferStatus
    errorCode: string | null
    destination: string | null
    onboardingUrl: string | null
  } | null
  fulfillmentStatus: FulfillmentStatus
  supplierNames: string[]
  trackingNumber: string | null
  createdAt: string
}

export function toAdminOrderListRow(order: OrderWithLinks): AdminOrderListRow {
  const supplierNames = [
    ...new Set(
      order.supplierFulfillmentLinks
        .map((l) => l.supplierFulfillmentOrder?.provider.name)
        .filter((n): n is string => Boolean(n))
    ),
  ]

  const supplierAttempt = order.transferAttempts.find((a) => a.role === "SUPPLIER")
  const affiliateAttempt = order.transferAttempts.find((a) => a.role === "AFFILIATE")

  const affiliateNeedsOnboarding =
    affiliateAttempt?.errorCode === "AFFILIATE_ONBOARDING_REQUIRED" ||
    affiliateAttempt?.errorCode === "insufficient_capabilities_for_transfer"

  return {
    id: order.id,
    orderNumber: formatOrderNumber(order.id),
    customerEmail: order.customerEmail,
    amountCents: order.totalCents ?? order.sellingPriceCents,
    paymentStatus: order.status,
    splitStatus: order.splitStatus,
    supplierTransfer: supplierAttempt
      ? {
          amountCents: supplierAttempt.amountCents,
          status: supplierAttempt.status,
          errorCode: supplierAttempt.errorCode,
        }
      : null,
    affiliateTransfer: affiliateAttempt
      ? {
          amountCents: affiliateAttempt.amountCents,
          status: affiliateAttempt.status,
          errorCode: affiliateAttempt.errorCode,
          destination: affiliateAttempt.destination,
          onboardingUrl: affiliateNeedsOnboarding
            ? stripeConnectDashboardUrl(affiliateAttempt.destination)
            : null,
        }
      : null,
    fulfillmentStatus: order.fulfillmentStatus,
    supplierNames,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt.toISOString(),
  }
}
