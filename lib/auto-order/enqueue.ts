import { enqueueAutoFulfillmentBatch } from "@/lib/auto-order/engine"
import { publishAutoOrderEvent } from "@/lib/auto-order/queue"
import { logAutoOrder } from "@/lib/auto-order/telemetry"

/** Idempotent batch row + async worker via Inngest (BullMQ-compatible event shape). */
export async function triggerAutoFulfillmentForStripeSession(stripeSessionId: string): Promise<void> {
  if (process.env.AUTO_ORDER_ENABLED === "false") return

  const batchId = await enqueueAutoFulfillmentBatch(stripeSessionId)
  if (!batchId) return

  try {
    await publishAutoOrderEvent({
      name: "auto-order/batch.fulfill",
      data: { stripeSessionId, batchId },
      id: `auto-order-${stripeSessionId}`,
    })
    logAutoOrder("inngest_sent", { stripeSessionId, batchId })
  } catch (e) {
    console.error("[auto-order] inngest.send failed", e)
  }
}
