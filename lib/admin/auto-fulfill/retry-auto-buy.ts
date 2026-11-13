import type { AutoBuyStatus } from "@prisma/client"

import { enqueueAutoBuyJob } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { isAutoBuyDisabled, MAX_ATTEMPTS } from "@/lib/fulfillment/auto-buy"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"
import { prisma } from "@/lib/prisma"

const STUCK_BUYING_MS = 10 * 60 * 1000

/** Trace written by `settleRefusedAutoBuy` (`formatAutoBuyMarginRefusal`). */
const MARGIN_REFUSED_PREFIX = "MARGIN_REFUSED:"

export function canRetryAutoBuyLog(input: {
  status: AutoBuyStatus
  attempts: number
}): boolean {
  if (input.status === "PENDING") return true
  // BUYING is never retryable: a claim without a recorded outcome may be a REAL AliExpress order whose answer was lost.
  // Re-running it could buy twice (see `lib/fulfillment/supplier-purchase-guard.ts`). It has to be reconciled by a human.
  if (input.status === "FAILED" && input.attempts < MAX_ATTEMPTS) return true
  return false
}

export type RetryAutoBuyResult =
  | { ok: true; fulfillmentLogId: string; queue: "bullmq" | "inngest" }
  | { ok: false; error: string; status: number; detail?: string }

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
      errorMsg: true,
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

  if (log.status === "BUYING") {
    const ageMs = Date.now() - log.updatedAt.getTime()
    if (ageMs < STUCK_BUYING_MS) {
      return { ok: false, error: "auto_buy_in_progress", status: 409 }
    }
    // Used to reset a "stuck" BUYING log to PENDING and buy again. A claim with no recorded outcome can be a purchase that
    // exists at AliExpress with its answer lost: refuse, and let a human reconcile it (AGENTS.md, "in doubt").
    return { ok: false, error: "purchase_in_doubt", status: 409 }
  }

  // A margin refusal is a DECISION about the sale. "Retrying" it used to flip the log to PENDING and erase the trace while the
  // queue (which keeps a finished job with the same id) silently ran nothing. Say so explicitly and touch nothing: the owner
  // fixes the price / the floor, then re-runs it through POST /api/orders/<id>/fulfill, which re-evaluates the margin.
  if (log.status === "FAILED" && log.errorMsg?.startsWith(MARGIN_REFUSED_PREFIX)) {
    return { ok: false, error: "margin_refused", status: 409, detail: log.errorMsg }
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

  if (log.status === "FAILED") {
    // Conditional: the log was read a moment ago; a claim taken since (BUYING) must not be reset to PENDING.
    // The last error is kept (not nulled): the next claim clears it, and until then it is the only trace of why it failed.
    const reset = await prisma.fulfillmentLog.updateMany({
      where: { id: log.id, status: "FAILED" },
      data: { status: "PENDING" },
    })
    if (reset.count !== 1) {
      return { ok: false, error: "log_state_changed", status: 409 }
    }
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
