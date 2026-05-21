import { enqueueBatchFulfillJob } from "@/lib/auto-order/bullmq/place-order.queue"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"

export type AutoOrderQueueEvent = {
  name: "auto-order/batch.fulfill"
  data: { stripeSessionId: string; batchId?: string | null }
  id?: string
}

export async function publishAutoOrderEvent(event: AutoOrderQueueEvent): Promise<void> {
  if (isAutoOrderQueueEnabled()) {
    await enqueueBatchFulfillJob(event.data)
    return
  }

  const { inngest } = await import("@/inngest/client")
  await inngest.send(event)
}
