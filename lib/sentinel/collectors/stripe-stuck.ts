import { formatOrderNumber } from "@/lib/admin/orders/list-query"
import { findStuckStripeHealthOrders } from "@/lib/cron/stripe-health"
import type { SentinelSignalInput } from "@/lib/sentinel/types"

export async function collectStripeStuckSignals(): Promise<SentinelSignalInput[]> {
  const stuck = await findStuckStripeHealthOrders(1)
  return stuck.map((o) => ({
    severity: "P0" as const,
    domain: "stripe" as const,
    code: "stripe.settlement_stuck",
    title: `Paid order unsettled — ${formatOrderNumber(o.orderId)}`,
    detail:
      o.webhookError?.trim() ||
      `Payment settlement ${o.paymentSettlementStatus}; webhook ${o.webhookStatus ?? "none"}. Customer: ${o.customerEmail}.`,
    entityType: "order",
    entityId: o.orderId,
    playbook: "open-stripe-health" as const,
  }))
}
