import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

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

  return rows.map((log) => ({
    severity: "P1" as const,
    domain: "fulfillment" as const,
    code: "fulfillment.autobuy_failed",
    title: `Auto-buy failed — ${log.order.product?.name?.slice(0, 48) ?? log.orderId}`,
    detail: log.errorMsg?.trim() || `Auto-buy failed after ${log.attempts} attempt(s). Order ${log.orderId}.`,
    metric: log.attempts,
    entityType: "fulfillmentLog",
    entityId: log.id,
    playbook: "retry-auto-buy" as const,
  }))
}
