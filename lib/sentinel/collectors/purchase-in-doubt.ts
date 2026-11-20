import { PURCHASE_IN_DOUBT_AFTER_MS } from "@/lib/fulfillment/supplier-purchase-decision"
import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

/**
 * AliExpress purchases IN DOUBT: a `FulfillmentLog` still in BUYING long after the claim was taken.
 *
 * A claim is taken BEFORE the supplier is contacted and is never released by time (a lost answer must not become a second
 * purchase — `lib/fulfillment/supplier-purchase-guard.ts`). When the process dies between the claim and the supplier's answer
 * (timeout of the function, redeploy of the worker, OOM) nothing runs afterwards that could alert: no report is ever sent by
 * the dead process, and a replay that would notice only exists if something triggers it again. This sweep, run by the existing
 * `sentinel-scan` cron, is the detector for that case. Signals are idempotent (same order = same row) and a NEW P0 is pushed
 * to the ops webhook by `runSentinelScan`; the signal closes by itself once the log leaves BUYING (human reconciliation).
 */
export async function collectPurchaseInDoubtSignals(now: Date = new Date()): Promise<SentinelSignalInput[]> {
  const cutoff = new Date(now.getTime() - PURCHASE_IN_DOUBT_AFTER_MS)
  const rows = await prisma.fulfillmentLog.findMany({
    where: { status: "BUYING", updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: { id: true, orderId: true, attempts: true, updatedAt: true, errorMsg: true },
  })

  return rows.map((log) => ({
    severity: "P0" as const,
    domain: "fulfillment" as const,
    code: "fulfillment.purchase_in_doubt",
    title: `AliExpress purchase in doubt — order ${log.orderId}`,
    detail:
      `A purchase claim has had no outcome since ${log.updatedAt.toISOString()} (attempt ${log.attempts}). ` +
      `An AliExpress order MAY exist. Check the AliExpress order list BEFORE any retry or refund: if it exists, set ` +
      `Order.supplierOrderId and the log to BOUGHT; if not, set the log to FAILED (that releases the claim).` +
      (log.errorMsg ? ` Last message: ${log.errorMsg.slice(0, 200)}` : ""),
    metric: log.attempts,
    entityType: "order",
    entityId: log.orderId,
    playbook: "open-order" as const,
  }))
}
