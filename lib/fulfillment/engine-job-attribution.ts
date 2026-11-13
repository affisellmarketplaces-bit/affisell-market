/**
 * Which ORDER does an engine job's supplier order id belong to? — one shared answer for every reader.
 *
 * The generic engine groups every order of a checkout session that goes to the same provider into ONE
 * `SupplierFulfillmentOrder` (one `SupplierFulfillmentOrderLine` per order) and keeps ONE `supplierOrderId` on the job.
 *
 *   - AliExpress: the adapter (`AliExpressSupplierAdapter.placeOrder`) buys only the job's FIRST line. The job's supplier
 *     order id is that one order's purchase and proves nothing about the others.
 *   - Every other provider (CJ Dropshipping, blind REST…) sends ALL the lines in a single supplier order: the id covers every
 *     line of the job.
 *
 * "First line" = the line with the smallest id: lines are created in order by the engine and ids are monotonic, so this is
 * the line `placeAliExpressOrderUnderClaim` bought (`input.group.lines[0]`). For jobs created before the purchase gate this is
 * an assumption, not a record.
 *
 * Readers that must use this instead of attributing `job.supplierOrderId` to every line of the job:
 * `decideSupplierPurchase` (is this order already bought?), `attemptExternalOrderCancellation` (what to cancel when this order
 * is refunded), `cancelSupplierFulfillmentJob` (which order's AliExpress purchase to cancel), the payout gate in
 * `processOneAttempt` (is this order's upstream funded?) and `applySupplierPlaceOrderResult` (which lines were bought).
 */

import type { Prisma } from "@prisma/client"

/** Select fragment (relations of `SupplierFulfillmentOrder`) that gives a reader everything `jobAttributionOf` needs. */
export const ENGINE_JOB_ATTRIBUTION_SELECT = {
  provider: { select: { channelType: true } },
  lines: { select: { orderId: true }, orderBy: { id: "asc" }, take: 1 },
} satisfies Prisma.SupplierFulfillmentOrderSelect

export type JobAttribution = {
  /** Provider channel of the job; null / unknown is treated as "covers every line" (fail closed against a double purchase). */
  channelType: string | null
  /** The order of the job's first line (null = unknown). */
  firstLineOrderId: string | null
}

type JobWithAttributionSelect = {
  provider?: { channelType: string | null } | null
  lines?: ReadonlyArray<{ orderId: string }> | null
}

/** Build the attribution from a job loaded with `ENGINE_JOB_ATTRIBUTION_SELECT`. */
export function jobAttributionOf(job: JobWithAttributionSelect): JobAttribution {
  return {
    channelType: job.provider?.channelType ?? null,
    firstLineOrderId: job.lines?.[0]?.orderId ?? null,
  }
}

/** Does the job's supplier order id belong to THIS order? */
export function jobSupplierOrderCoversOrder(job: JobAttribution, orderId: string): boolean {
  if (job.channelType !== "ALIEXPRESS") return true
  return job.firstLineOrderId == null || job.firstLineOrderId === orderId
}

/** Is this an AliExpress job that groups several orders (only the first of which was bought)? */
export function isSharedAliExpressJob(job: { channelType: string | null; lineCount: number }): boolean {
  return job.channelType === "ALIEXPRESS" && job.lineCount > 1
}
