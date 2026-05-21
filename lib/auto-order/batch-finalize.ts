import type { FulfillmentStatus, Prisma } from "@prisma/client"

import { logAutoOrder } from "@/lib/auto-order/telemetry"
import type { BatchRunResult } from "@/lib/auto-order/types"
import { prisma } from "@/lib/prisma"

const SUCCESS_STATUSES = new Set(["CONFIRMED", "SHIPPED", "DELIVERED"])

export async function finalizeAutoFulfillmentBatch(batchId: string): Promise<BatchRunResult> {
  const batch = await prisma.autoFulfillmentBatch.findUnique({
    where: { id: batchId },
    include: {
      supplierJobs: {
        select: { id: true, status: true, errorMessage: true, fulfillmentProviderId: true },
      },
    },
  })
  if (!batch) throw new Error(`batch_not_found:${batchId}`)

  const pending = batch.supplierJobs.filter(
    (j) => j.status === "PENDING" || j.status === "PROCESSING"
  )
  if (pending.length > 0) {
    logAutoOrder("batch_finalize_skipped_pending", { batchId, pending: pending.length })
    return {
      batchId,
      fulfillmentStatus: batch.fulfillmentStatus,
      jobs: batch.supplierJobs.map((j) => ({
        jobId: j.id,
        status: j.status,
        error: j.errorMessage ?? undefined,
      })),
    }
  }

  const jobCount = batch.supplierJobs.length
  let successCount = 0
  const errors: Array<{ providerId: string; message: string }> = []

  for (const job of batch.supplierJobs) {
    if (SUCCESS_STATUSES.has(job.status)) successCount += 1
    else if (job.status === "FAILED" && job.errorMessage) {
      errors.push({ providerId: job.fulfillmentProviderId, message: job.errorMessage })
    }
  }

  const fulfillmentStatus: FulfillmentStatus =
    successCount === 0
      ? "FAILED"
      : successCount < jobCount
        ? "PARTIAL"
        : "ORDERED"

  await prisma.autoFulfillmentBatch.update({
    where: { id: batchId },
    data: {
      status: errors.length ? (successCount ? "PARTIAL" : "FAILED") : "COMPLETED",
      fulfillmentStatus,
      supplierJobCount: batch.supplierJobs.length,
      errors: errors.length ? (errors as Prisma.InputJsonValue) : undefined,
      completedAt: new Date(),
    },
  })

  logAutoOrder("batch_completed", { batchId, fulfillmentStatus, jobs: batch.supplierJobs.length })

  return {
    batchId,
    fulfillmentStatus,
    jobs: batch.supplierJobs.map((j) => ({
      jobId: j.id,
      status: j.status,
      error: j.errorMessage ?? undefined,
    })),
  }
}
