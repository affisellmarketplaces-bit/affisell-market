import { Job, Queue, Worker, type JobsOptions } from "bullmq"

import { fulfillAffisellOrderWithAliExpress } from "@/lib/aliexpress-fulfill-order"
import { createRedisConnection, getRedisConnection, isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"

/** BullMQ / Inngest event name for paid → AE DS place. */
export const ORDER_PAID_QUEUE = "order-paid"
export const ORDER_PAID_EVENT = "order.paid" as const

export type OrderPaidJobData = {
  orderId: string
}

const ATTEMPTS = 3
const BACKOFF_MS = 30_000

let queue: Queue<OrderPaidJobData> | null = null

function defaultJobOptions(delayMs?: number): JobsOptions {
  return {
    attempts: ATTEMPTS,
    backoff: { type: "exponential", delay: BACKOFF_MS },
    removeOnComplete: { count: 5000 },
    removeOnFail: false,
    ...(delayMs != null && delayMs > 0 ? { delay: delayMs } : {}),
  }
}

export function getOrderPaidQueue(): Queue<OrderPaidJobData> {
  if (!queue) {
    queue = new Queue<OrderPaidJobData>(ORDER_PAID_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobOptions(),
    })
  }
  return queue
}

export function orderPaidJobId(orderId: string): string {
  return `order-paid-${orderId}`
}

/** Enqueue AE fulfill for a paid Affisell order (idempotent job id). */
export async function enqueueOrderPaidJob(
  data: OrderPaidJobData,
  opts?: { delayMs?: number }
): Promise<Job<OrderPaidJobData> | null> {
  console.log("[order-paid]", { result: "enqueue", orderId: data.orderId })

  if (!isAutoOrderQueueEnabled()) {
    const { inngest } = await import("@/inngest/client")
    await inngest.send({
      name: ORDER_PAID_EVENT,
      data,
      id: orderPaidJobId(data.orderId),
    })
    return null
  }

  const jobId = orderPaidJobId(data.orderId)
  const q = getOrderPaidQueue()
  const existing = await q.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === "completed" || state === "active" || state === "waiting" || state === "delayed") {
      return existing
    }
    if (state === "failed") {
      await existing.retry()
      return existing
    }
  }

  return q.add("fulfill", data, {
    jobId,
    ...defaultJobOptions(opts?.delayMs),
  })
}

export function createOrderPaidWorker(): Worker<OrderPaidJobData> {
  const concurrency = Math.max(1, Number(process.env.ORDER_PAID_WORKER_CONCURRENCY ?? "2"))
  return new Worker<OrderPaidJobData>(
    ORDER_PAID_QUEUE,
    async (job) => {
      console.log("[order-paid]", {
        result: "process",
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1,
      })
      const result = await fulfillAffisellOrderWithAliExpress(job.data.orderId)
      if (!result.ok) {
        const retryable =
          result.error.includes("rate") ||
          result.error.includes("limit") ||
          result.error.includes("timeout") ||
          result.error.includes("temporarily")
        if (retryable) {
          throw new Error(result.error)
        }
        console.log("[order-paid]", {
          result: "non_retryable",
          orderId: job.data.orderId,
          error: result.error,
        })
        return
      }
      console.log("[order-paid]", {
        result: "ok",
        orderId: job.data.orderId,
        aliexpressOrderIdTail: result.aliexpressOrderId.slice(-6),
      })
    },
    {
      connection: createRedisConnection(),
      concurrency,
    }
  )
}
