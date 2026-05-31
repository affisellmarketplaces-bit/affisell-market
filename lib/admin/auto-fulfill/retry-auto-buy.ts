import type { AutoBuyStatus } from "@prisma/client"

import { enqueueAutoBuyJob } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { isAutoBuyDisabled, MAX_ATTEMPTS } from "@/lib/fulfillment/auto-buy"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"
import { prisma } from "@/lib/prisma"

const STUCK_BUYING_MS = 10 * 60 * 1000

export function canRetryAutoBuyLog(input: {
  status: AutoBuyStatus
  attempts: number
}): boolean {
  if (input.status === "PENDING") return true
  if (input.status === "BUYING") return true
  if (input.status === "FAILED" && input.attempts < MAX_ATTEMPTS) return true
  return false
}

export type RetryAutoBuyResult =
  | { ok: true; fulfillmentLogId: string; queue: "bullmq" | "inngest" }
  | { ok: false; error: string; status: number }

/** Re-enqueue a FulfillmentLog for the auto-buy worker (admin). */
export async function retryAdminAutoBuyFulfillmentLog(
  fulfillmentLogId: string
): Promise<RetryAutoBuyResult> {
  if (isAutoBuyDisabled()) {
    return { ok: false, error: "auto_buy_disabled", status: 503 }
  }

  const log = await prisma.fulfillmentLog.findUnique({
    where: { id: fulfillmentLogId },
    select: {
      id: true,
      status: true,
      attempts: true,
      updatedAt: true,
      order: {
        select: {
          id: true,
          product: {
            select: {
              autoBuyEnabled: true,
              autoFulfill: true,
              supplierLink: {
                select: { isActive: true, autoBuyEnabled: true },
              },
            },
          },
        },
      },
    },
  })

  if (!log) {
    return { ok: false, error: "log_not_found", status: 404 }
  }

  if (log.status === "BOUGHT" || log.status === "REFUNDED") {
    return { ok: false, error: "log_not_retryable", status: 409 }
  }

  if (!canRetryAutoBuyLog({ status: log.status, attempts: log.attempts })) {
    return { ok: false, error: "max_attempts_reached", status: 409 }
  }

  const link = log.order.product.supplierLink
  const productAutoBuy =
    log.order.product.autoBuyEnabled || log.order.product.autoFulfill
  if (!link?.isActive || (!link.autoBuyEnabled && !productAutoBuy)) {
    return { ok: false, error: "no_supplier_link_or_auto_buy_off", status: 400 }
  }

  if (log.status === "BUYING") {
    const ageMs = Date.now() - log.updatedAt.getTime()
    if (ageMs < STUCK_BUYING_MS) {
      return { ok: false, error: "auto_buy_in_progress", status: 409 }
    }
  }

  if (log.status === "BUYING" || log.status === "FAILED") {
    await prisma.fulfillmentLog.update({
      where: { id: log.id },
      data: { status: "PENDING", errorMsg: null },
    })
  }

  try {
    await enqueueAutoBuyJob({ fulfillmentLogId: log.id })
  } catch (e) {
    console.error("[admin-auto-buy-retry] enqueue_failed", {
      fulfillmentLogId: log.id,
      error: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, error: "queue_enqueue_failed", status: 503 }
  }

  console.log("[admin-auto-buy-retry]", {
    fulfillmentLogId: log.id,
    orderId: log.order.id,
    previousStatus: log.status,
    queue: isAutoOrderQueueEnabled() ? "bullmq" : "inngest",
  })

  return {
    ok: true,
    fulfillmentLogId: log.id,
    queue: isAutoOrderQueueEnabled() ? "bullmq" : "inngest",
  }
}
