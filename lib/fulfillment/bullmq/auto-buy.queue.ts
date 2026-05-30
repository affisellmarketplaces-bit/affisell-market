import { Job, Queue, Worker, type JobsOptions } from "bullmq"

import { processAutoBuyFulfillmentLog } from "@/lib/fulfillment/auto-buy"
import { createRedisConnection, getRedisConnection, isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"

export const AUTO_BUY_QUEUE = "auto-buy"

export type AutoBuyJobData = {
  fulfillmentLogId: string
}

const ATTEMPTS = 3
const BACKOFF_MS = 10 * 60 * 1000

let queue: Queue<AutoBuyJobData> | null = null

function defaultJobOptions(delayMs?: number): JobsOptions {
  return {
    attempts: ATTEMPTS,
    backoff: { type: "fixed", delay: BACKOFF_MS },
    removeOnComplete: { count: 5000 },
    removeOnFail: false,
    ...(delayMs != null && delayMs > 0 ? { delay: delayMs } : {}),
  }
}

export function getAutoBuyQueue(): Queue<AutoBuyJobData> {
  if (!queue) {
    queue = new Queue<AutoBuyJobData>(AUTO_BUY_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobOptions(),
    })
  }
  return queue
}

export function autoBuyJobId(fulfillmentLogId: string): string {
  return `auto-buy-${fulfillmentLogId}`
}

export async function enqueueAutoBuyJob(
  data: AutoBuyJobData,
  opts?: { delayMs?: number }
): Promise<Job<AutoBuyJobData> | null> {
  if (!isAutoOrderQueueEnabled()) {
    const { inngest } = await import("@/inngest/client")
    await inngest.send({
      name: "auto-buy/process",
      data,
      id: `auto-buy-${data.fulfillmentLogId}`,
    })
    return null
  }

  const jobId = autoBuyJobId(data.fulfillmentLogId)
  const q = getAutoBuyQueue()
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

  return q.add("buy", data, {
    jobId,
    ...defaultJobOptions(opts?.delayMs),
  })
}

export function createAutoBuyWorker(): Worker<AutoBuyJobData> {
  const concurrency = Math.max(1, Number(process.env.AUTO_BUY_WORKER_CONCURRENCY ?? "1"))
  return new Worker<AutoBuyJobData>(
    AUTO_BUY_QUEUE,
    async (job) => {
      await processAutoBuyFulfillmentLog(job.data.fulfillmentLogId)
    },
    {
      connection: createRedisConnection(),
      concurrency,
    }
  )
}
