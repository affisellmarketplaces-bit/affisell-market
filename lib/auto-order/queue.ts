/**
 * Queue abstraction — v1 uses Inngest; swap implementation for BullMQ + Redis when REDIS_URL is set.
 */
export type AutoOrderQueueEvent = {
  name: "auto-order/batch.fulfill"
  data: { stripeSessionId: string; batchId?: string | null }
  id?: string
}

export async function publishAutoOrderEvent(event: AutoOrderQueueEvent): Promise<void> {
  const { inngest } = await import("@/inngest/client")
  await inngest.send(event)
}
