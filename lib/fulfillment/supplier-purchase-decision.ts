/**
 * What may happen to ONE order at the supplier — pure decision, no I/O (G2).
 *
 * The decision is evaluated by `lib/fulfillment/supplier-purchase-guard.ts` INSIDE the per-order advisory lock, on a
 * snapshot re-read inside that lock. Keeping it pure is what lets a test enumerate every state.
 *
 * The three AliExpress paths (generic engine, `auto-buy.ts`, `order.paid` / manual fulfil) all go through it, so they all
 * agree on "has this order already been bought?":
 *
 *   evidence of a purchase  ─► `Order.supplierOrderId`, a BOUGHT `FulfillmentLog`, or a `SupplierFulfillmentOrder`
 *                              (engine job) that carries a supplier order id and was not failed / cancelled.
 *   purchase in flight      ─► a `FulfillmentLog` in BUYING: somebody claimed it and has not recorded an outcome.
 *
 * A BUYING marker NEVER expires into a second purchase. If the process died after AliExpress accepted the order but
 * before the answer was recorded, only a human can tell (AliExpress order list) — so a stale marker is reported as
 * "in doubt" (`stale: true`) and the purchase is still refused. Only a definitive failure moves the marker to FAILED.
 */

import type { AutoBuyStatus, SupplierFulfillmentStatus } from "@prisma/client"

/** An order may be bought while it is in one of these states (same set `fulfillAffisellOrderWithAliExpress` always accepted). */
export const PURCHASABLE_ORDER_STATUSES: readonly string[] = ["paid", "fulfilling", "preparing"]

/** A BUYING marker older than this is reported as "in doubt" (alert) — it still blocks any new purchase. */
export const PURCHASE_IN_DOUBT_AFTER_MS = 15 * 60 * 1000

export type PurchaseSnapshot = {
  orderId: string
  /** `Order.status` */
  status: string
  /** `Order.supplierOrderId` */
  supplierOrderId: string | null
  /** `Order.autoBuyLog` (FulfillmentLog, one per order) */
  log: { status: AutoBuyStatus; aeOrderId: string | null; attempts: number; updatedAt: Date } | null
  /** Engine jobs (`SupplierFulfillmentOrder`) that include this order. */
  jobs: ReadonlyArray<{ id: string; supplierOrderId: string | null; status: SupplierFulfillmentStatus }>
}

export type PurchaseDecision =
  | { kind: "claim"; attempt: number }
  | {
      kind: "already_placed"
      supplierOrderId: string
      evidence: "order" | "log" | "job"
    }
  | { kind: "in_progress"; stale: boolean; since: Date | null }
  | { kind: "not_purchasable"; orderStatus: string; reason: "order_status" | "refunded" }

const trimmed = (v: string | null | undefined): string => v?.trim() ?? ""

export function decideSupplierPurchase(
  snapshot: PurchaseSnapshot,
  now: Date = new Date()
): PurchaseDecision {
  // 1. Anything that proves an order exists at the supplier wins over every other consideration.
  const onOrder = trimmed(snapshot.supplierOrderId)
  if (onOrder) return { kind: "already_placed", supplierOrderId: onOrder, evidence: "order" }

  if (snapshot.log?.status === "BOUGHT") {
    return {
      kind: "already_placed",
      supplierOrderId: trimmed(snapshot.log.aeOrderId) || "unknown",
      evidence: "log",
    }
  }

  for (const job of snapshot.jobs) {
    const id = trimmed(job.supplierOrderId)
    if (id && job.status !== "FAILED" && job.status !== "CANCELLED") {
      return { kind: "already_placed", supplierOrderId: id, evidence: "job" }
    }
  }

  // 2. Not bought. Is the order still something we may buy for?
  if (!PURCHASABLE_ORDER_STATUSES.includes(snapshot.status)) {
    return { kind: "not_purchasable", orderStatus: snapshot.status, reason: "order_status" }
  }
  if (snapshot.log?.status === "REFUNDED") {
    return { kind: "not_purchasable", orderStatus: snapshot.status, reason: "refunded" }
  }

  // 3. Somebody already claimed it and recorded no outcome: replay in READ mode, never buy again.
  if (snapshot.log?.status === "BUYING") {
    const since = snapshot.log.updatedAt ?? null
    const stale = since ? now.getTime() - since.getTime() > PURCHASE_IN_DOUBT_AFTER_MS : true
    return { kind: "in_progress", stale, since }
  }

  // 4. PENDING / FAILED (definitive failure) / no log yet: claimable.
  return { kind: "claim", attempt: (snapshot.log?.attempts ?? 0) + 1 }
}
