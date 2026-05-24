import { formatOrderNumber } from "@/lib/admin/orders/list-query"
import { stripeConnectDashboardUrl } from "@/lib/admin/stripe-health/stripe-dashboard-url"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

const MS_PER_HOUR = 3_600_000

export type StuckStripeOrder = {
  orderId: string
  orderNumber: string
  customerEmail: string
  totalCents: number
  createdAt: Date
  paymentSettlementStatus: string
  webhookStatus: string | null
  webhookError: string | null
}

export async function findStuckStripeHealthOrders(
  olderThanHours = 1
): Promise<StuckStripeOrder[]> {
  const cutoff = new Date(Date.now() - olderThanHours * MS_PER_HOUR)
  const lookback = new Date(Date.now() - 30 * 24 * MS_PER_HOUR)

  const orders = await prisma.order.findMany({
    where: {
      status: "paid",
      paymentSettlementStatus: { not: "SETTLED" },
      createdAt: { gte: lookback, lte: cutoff },
      NOT: { stripeSessionId: { startsWith: "pending_" } },
    },
    select: {
      id: true,
      customerEmail: true,
      totalCents: true,
      sellingPriceCents: true,
      createdAt: true,
      paymentSettlementStatus: true,
      affiliateStripeAccountId: true,
      supplier: { select: { stripeAccountId: true } },
      affiliate: { select: { stripeAccountId: true } },
    },
    take: 100,
  })

  if (orders.length === 0) return []

  const orderIds = orders.map((o) => o.id)
  const successWebhooks = await prisma.processedWebhook.findMany({
    where: { orderId: { in: orderIds }, status: "success" },
    select: { orderId: true },
  })
  const successOrderIds = new Set(
    successWebhooks.map((w) => w.orderId).filter((id): id is string => Boolean(id))
  )

  const latestWebhooks = await prisma.processedWebhook.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: "desc" },
  })
  const latestByOrder = new Map<string, (typeof latestWebhooks)[number]>()
  for (const w of latestWebhooks) {
    if (w.orderId && !latestByOrder.has(w.orderId)) latestByOrder.set(w.orderId, w)
  }

  const stuck: StuckStripeOrder[] = []

  for (const order of orders) {
    if (successOrderIds.has(order.id)) continue

    const latest = latestByOrder.get(order.id)
    stuck.push({
      orderId: order.id,
      orderNumber: formatOrderNumber(order.id),
      customerEmail: order.customerEmail,
      totalCents: order.totalCents ?? order.sellingPriceCents,
      createdAt: order.createdAt,
      paymentSettlementStatus: order.paymentSettlementStatus,
      webhookStatus: latest?.status ?? null,
      webhookError: latest?.error ?? null,
    })
  }

  return stuck
}

export function formatStuckStripeHealthSlackMessage(orders: StuckStripeOrder[]): string {
  const lines = orders.slice(0, 20).map((o) => {
    const acct =
      o.webhookError?.match(/\b(acct_[a-zA-Z0-9]+)\b/)?.[1] ??
      null
    const dash = acct ? stripeConnectDashboardUrl(acct) : null
    return [
      `• *#${o.orderNumber}* (${o.orderId})`,
      `  paid ${(o.totalCents / 100).toFixed(2)}€ — settlement: ${o.paymentSettlementStatus}`,
      `  webhook: ${o.webhookStatus ?? "none"}${o.webhookError ? ` — ${o.webhookError.slice(0, 120)}` : ""}`,
      dash ? `  <${dash}|Stripe account>` : null,
    ]
      .filter(Boolean)
      .join("\n")
  })

  return [
    `:warning: *Stripe health* — ${orders.length} commande(s) payée(s) >1h sans webhook \`success\``,
    "",
    ...lines,
    orders.length > 20 ? `\n… et ${orders.length - 20} autres` : "",
  ].join("\n")
}

export async function runStripeHealthCron(options?: { olderThanHours?: number }) {
  const stuck = await findStuckStripeHealthOrders(options?.olderThanHours ?? 1)
  if (stuck.length === 0) {
    return { ok: true, alerted: false, stuckCount: 0 }
  }

  const text = formatStuckStripeHealthSlackMessage(stuck)
  await opsWebhookAlert(text)

  return { ok: true, alerted: true, stuckCount: stuck.length, orderIds: stuck.map((o) => o.orderId) }
}
