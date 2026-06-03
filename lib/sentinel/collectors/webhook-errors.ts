import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

export async function collectWebhookErrorSignals(): Promise<SentinelSignalInput[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const rows = await prisma.processedWebhook.findMany({
    where: {
      createdAt: { gte: since },
      NOT: { status: "success" },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return rows.map((w) => ({
    severity: "P1" as const,
    domain: "webhook" as const,
    code: "webhook.processing_failed",
    title: `Stripe webhook ${w.status} — ${w.id.slice(0, 18)}…`,
    detail: w.error?.trim() || `Webhook event ${w.id} ended with status ${w.status}.`,
    entityType: w.orderId ? "order" : "webhook",
    entityId: w.orderId ?? w.id,
    playbook: w.orderId ? ("open-order" as const) : ("open-stripe-health" as const),
  }))
}
