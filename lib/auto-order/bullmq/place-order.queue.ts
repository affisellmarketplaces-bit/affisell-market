import { Job, Queue, Worker, type JobsOptions } from "bullmq"

import {
  BATCH_FULFILL_QUEUE,
  PLACE_SUPPLIER_ORDER_DLQ,
  PLACE_SUPPLIER_ORDER_QUEUE,
  placeSupplierOrderJobId,
} from "@/lib/auto-order/bullmq/names"
import type { PlaceSupplierOrderJobData } from "@/lib/auto-order/bullmq/place-order.types"
import { processPlaceSupplierOrderJob } from "@/lib/auto-order/bullmq/place-order.processor"
import { createRedisConnection, getRedisConnection, isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"
import { logAutoOrder } from "@/lib/auto-order/telemetry"

const PLACE_ORDER_ATTEMPTS = 6
const PLACE_ORDER_BACKOFF_MS = 5_000

let placeQueue: Queue<PlaceSupplierOrderJobData> | null = null
let dlqQueue: Queue<PlaceSupplierOrderJobData> | null = null

function defaultJobOptions(): JobsOptions {
  return {
    attempts: PLACE_ORDER_ATTEMPTS,
    backoff: { type: "exponential", delay: PLACE_ORDER_BACKOFF_MS },
    removeOnComplete: { count: 2000 },
    removeOnFail: false,
  }
}

/** Lazy accessor for Bull Board (`new BullMQAdapter(placeOrderQueue())`). */
export function placeOrderQueue(): Queue<PlaceSupplierOrderJobData> {
  return getPlaceSupplierOrderQueue()
}

export function getPlaceSupplierOrderQueue(): Queue<PlaceSupplierOrderJobData> {
  if (!placeQueue) {
    placeQueue = new Queue<PlaceSupplierOrderJobData>(PLACE_SUPPLIER_ORDER_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobOptions(),
    })
  }
  return placeQueue
}

export function getPlaceSupplierOrderDlq(): Queue<PlaceSupplierOrderJobData> {
  if (!dlqQueue) {
    dlqQueue = new Queue<PlaceSupplierOrderJobData>(PLACE_SUPPLIER_ORDER_DLQ, {
      connection: getRedisConnection(),
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    })
  }
  return dlqQueue
}

export async function enqueuePlaceSupplierOrderJob(
  data: PlaceSupplierOrderJobData
): Promise<Job<PlaceSupplierOrderJobData> | null> {
  if (!isAutoOrderQueueEnabled()) return null

  const jobId = placeSupplierOrderJobId(data.supplierFulfillmentOrderId)
  const queue = getPlaceSupplierOrderQueue()

  const existing = await queue.getJob(jobId)
  if (existing) {
    const state = await existing.getState()
    if (state === "completed" || state === "active" || state === "waiting" || state === "delayed") {
      logAutoOrder("place_order_job_exists", { jobId, state })
      return existing
    }
    if (state === "failed") {
      await existing.retry()
      return existing
    }
  }

  const job = await queue.add("place", data, { jobId, ...defaultJobOptions() })
  logAutoOrder("place_order_enqueued", {
    jobId,
    supplierFulfillmentOrderId: data.supplierFulfillmentOrderId,
  })
  return job
}

async function moveJobToDlq(job: Job<PlaceSupplierOrderJobData>, reason: string) {
  const dlq = getPlaceSupplierOrderDlq()
  await dlq.add("dlq", job.data, {
    jobId: `dlq-${job.id}`,
    removeOnComplete: false,
  })
  logAutoOrder("place_order_dlq", { jobId: job.id ?? job.name ?? "unknown", reason })
}

export function createPlaceSupplierOrderWorker(): Worker<PlaceSupplierOrderJobData> {
  const connection = createRedisConnection()
  const worker = new Worker<PlaceSupplierOrderJobData>(
    PLACE_SUPPLIER_ORDER_QUEUE,
    async (job) => {
      await processPlaceSupplierOrderJob(job.data)
    },
    {
      connection,
      concurrency: Number(process.env.AUTO_ORDER_WORKER_CONCURRENCY ?? "4"),
    }
  )

  worker.on("failed", async (job, err) => {
    if (!job) return
    const max = job.opts.attempts ?? PLACE_ORDER_ATTEMPTS
    if (job.attemptsMade >= max) {
      const msg = err instanceof Error ? err.message : String(err)
      await moveJobToDlq(job, msg)
    }
  })

  return worker
}

export type BatchFulfillJobData = { stripeSessionId: string; batchId?: string | null }

let batchQueue: Queue<BatchFulfillJobData> | null = null

export function getBatchFulfillQueue(): Queue<BatchFulfillJobData> {
  if (!batchQueue) {
    batchQueue = new Queue<BatchFulfillJobData>(BATCH_FULFILL_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 500 },
      },
    })
  }
  return batchQueue
}

export async function enqueueBatchFulfillJob(data: BatchFulfillJobData): Promise<void> {
  if (!isAutoOrderQueueEnabled()) return
  const jobId = `batch-${data.stripeSessionId}`
  await getBatchFulfillQueue().add("fulfill", data, { jobId })
}

export function createBatchFulfillWorker(): Worker<BatchFulfillJobData> {
  const connection = createRedisConnection()
  return new Worker<BatchFulfillJobData>(
    BATCH_FULFILL_QUEUE,
    async (job) => {
      const { runAutoFulfillmentBatch } = await import("@/lib/auto-order/engine")
      const stripeSessionId = job.data.stripeSessionId
      if (!stripeSessionId) throw new Error("missing_stripeSessionId")
      await runAutoFulfillmentBatch(stripeSessionId)
    },
    { connection, concurrency: 2 }
  )
}
