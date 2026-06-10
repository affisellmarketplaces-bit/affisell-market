import { isChinaBuyingAgentId } from "@/lib/china-buying/china-buying-shared"
import { routeChinaBuy } from "@/lib/china-buying/route-china-buy"
import { prisma } from "@/lib/prisma"

/**
 * After payment: route paid orders to the product's China buying agent.
 * Idempotent per order via ChinaBuyRouteLog key `china-buy:order:{orderId}`.
 * Skips when auto-buy disabled (Quality Gate) or no agent configured.
 */
export async function triggerChinaBuyForPaidOrders(
  stripeSessionId: string
): Promise<{ triggered: number; skipped: number }> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { stripeSessionId },
        { stripeSessionId: { startsWith: `${stripeSessionId}:line:` } },
      ],
      status: "paid",
    },
    select: {
      id: true,
      quantity: true,
      supplierId: true,
      product: {
        select: {
          id: true,
          sourceUrl: true,
          chinaBuyingAgentId: true,
          chinaPlatform: true,
          autoBuyEnabled: true,
          autoFulfill: true,
        },
      },
    },
  })

  let triggered = 0
  let skipped = 0

  for (const order of orders) {
    const product = order.product
    const agentId = product.chinaBuyingAgentId
    const sourceUrl = product.sourceUrl?.trim()

    if (
      !product.autoFulfill ||
      !product.autoBuyEnabled ||
      !agentId ||
      !isChinaBuyingAgentId(agentId) ||
      !sourceUrl ||
      !/^https?:\/\//i.test(sourceUrl)
    ) {
      skipped += 1
      continue
    }

    const qty = Math.max(1, Math.min(99, order.quantity || 1))
    const result = await routeChinaBuy({
      supplierId: order.supplierId,
      sourceUrl,
      agentId,
      platform: product.chinaPlatform,
      productId: product.id,
      quantity: qty,
      idempotencyKey: `china-buy:order:${order.id}`,
    })

    if (result.ok) {
      triggered += 1
      console.log("[china-buy]", {
        orderId: order.id,
        productId: product.id,
        agentId,
        logId: result.logId,
        status: result.status,
        idempotent: result.idempotent ?? false,
        result: "order_triggered",
      })
    } else {
      skipped += 1
      console.log("[china-buy]", {
        orderId: order.id,
        productId: product.id,
        error: result.error,
        result: "order_skipped",
      })
    }
  }

  return { triggered, skipped }
}
