import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

/** Trace written by `settleRefusedAutoBuy` when the margin gate refused a purchase (`formatAutoBuyMarginRefusal`). */
const MARGIN_REFUSED_PREFIX = "MARGIN_REFUSED:"

export async function collectFulfillmentFailedSignals(): Promise<SentinelSignalInput[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const rows = await prisma.fulfillmentLog.findMany({
    where: { status: "FAILED", updatedAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
    take: 25,
    include: {
      order: {
        select: {
          id: true,
          customerEmail: true,
          product: { select: { name: true } },
        },
      },
    },
  })

  return rows.map((log): SentinelSignalInput => {
    const name = log.order.product?.name?.slice(0, 48) ?? log.orderId
    // A margin refusal is a DECISION about the sale, not a failure a retry can fix: no "retry" playbook (it could only
    // re-evaluate the same sale and refuse again). The owner opens the order and decides (price, floor, manual buy, refund).
    if (log.errorMsg?.startsWith(MARGIN_REFUSED_PREFIX)) {
      return {
        severity: "P1",
        domain: "fulfillment",
        code: "fulfillment.margin_refused",
        title: `Auto-buy refused on margin — ${name}`,
        detail: log.errorMsg,
        metric: log.attempts,
        entityType: "order",
        entityId: log.orderId,
        playbook: "open-order",
      }
    }
    return {
      severity: "P1",
      domain: "fulfillment",
      code: "fulfillment.autobuy_failed",
      title: `Auto-buy failed — ${name}`,
      detail: log.errorMsg?.trim() || `Auto-buy failed after ${log.attempts} attempt(s). Order ${log.orderId}.`,
      metric: log.attempts,
      entityType: "fulfillmentLog",
      entityId: log.id,
      playbook: "retry-auto-buy",
    }
  })
}
