import { formatOrderNumber } from "@/lib/admin/orders/list-query"
import {
  buildFailureDetail,
  classifyStripeHealthOrder,
} from "@/lib/admin/stripe-health/classify-order"
import type { StripeHealthOrderRow, StripeHealthStatus } from "@/lib/admin/stripe-health/types"
import { prisma } from "@/lib/prisma"

const MS_PER_DAY = 86_400_000

export type LoadStripeHealthOrdersOptions = {
  days?: number
  statusFilter?: StripeHealthStatus | "all"
}

export async function loadStripeHealthOrders(
  options: LoadStripeHealthOrdersOptions = {}
): Promise<StripeHealthOrderRow[]> {
  const days = options.days ?? 7
  const since = new Date(Date.now() - days * MS_PER_DAY)

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { status: "paid" },
        { paymentSettlementStatus: { in: ["PAID", "SETTLED", "PENDING"] } },
      ],
      NOT: { stripeSessionId: { startsWith: "pending_" } },
    },
    include: {
      supplier: {
        select: { stripeAccountId: true, stripeOnboardedAt: true },
      },
      affiliate: {
        select: { stripeAccountId: true, stripeOnboardedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  const orderIds = orders.map((o) => o.id)
  const webhooks =
    orderIds.length === 0
      ? []
      : await prisma.processedWebhook.findMany({
          where: { orderId: { in: orderIds } },
          orderBy: { createdAt: "desc" },
        })

  const latestWebhookByOrder = new Map<string, (typeof webhooks)[number]>()
  for (const row of webhooks) {
    if (!row.orderId) continue
    if (!latestWebhookByOrder.has(row.orderId)) {
      latestWebhookByOrder.set(row.orderId, row)
    }
  }

  const rows: StripeHealthOrderRow[] = orders.map((order) => {
    const webhook = latestWebhookByOrder.get(order.id) ?? null
    const supplierOnboarded = Boolean(order.supplier.stripeOnboardedAt)
    const affiliateOnboarded = Boolean(order.affiliate.stripeOnboardedAt)
    const input = {
      splitStatus: order.splitStatus,
      status: order.status,
      paymentSettlementStatus: order.paymentSettlementStatus,
      supplierPayoutCents: order.supplierPayoutCents,
      affiliatePayoutCents: order.affiliatePayoutCents,
      supplierOnboarded,
      affiliateOnboarded,
      affiliateStripeAccountId: order.affiliateStripeAccountId,
    }
    const stripeHealthStatus = classifyStripeHealthOrder(input, webhook)
    const failure = buildFailureDetail(webhook)

    return {
      id: order.id,
      orderNumber: formatOrderNumber(order.id),
      customerEmail: order.customerEmail,
      totalCents: order.totalCents ?? order.sellingPriceCents,
      createdAt: order.createdAt.toISOString(),
      stripeHealthStatus,
      paymentSettlementStatus: order.paymentSettlementStatus,
      supplierAccountId: order.supplier.stripeAccountId,
      affiliateAccountId:
        order.affiliateStripeAccountId?.trim() || order.affiliate.stripeAccountId,
      supplierOnboarded,
      affiliateOnboarded,
      webhookEventId: webhook?.id ?? null,
      webhookStatus: webhook?.status ?? null,
      failure,
    }
  })

  if (options.statusFilter && options.statusFilter !== "all") {
    return rows.filter((r) => r.stripeHealthStatus === options.statusFilter)
  }

  return rows
}
