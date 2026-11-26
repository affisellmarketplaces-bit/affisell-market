/**
 * THE single passage point before any AliExpress purchase (G2 + G3).
 *
 * Five fulfilment triggers fire in parallel on every payment (`lib/auto-order/enqueue.ts`, `lib/stripe-marketplace-fulfill.ts`)
 * and THREE code paths can place an AliExpress order: the generic engine (`lib/suppliers/place-order-bridge.ts`),
 * `lib/fulfillment/auto-buy.ts`, and `order.paid` / the manual `/api/orders/[id]/fulfill` route
 * (`lib/aliexpress-fulfill-order.ts`). Their only protection used to be an UNLOCKED read of `order.supplierOrderId`:
 * two workers could both read null and both buy. Every one of them now calls `authorizeSupplierPurchase` first.
 *
 * What it does, in this order, for ONE order:
 *   1. (outside the lock) evaluates the margin gate — `evaluateAutoBuyMargin`, G3;
 *   2. opens a transaction and takes `pg_advisory_xact_lock(hashtext('affisell:supplier-purchase:<orderId>'))` — the same
 *      mechanism the checkout fulfilment and the Medusa sync already use. The lock key is the ORDER, identical for the
 *      three paths, so they serialise against each other;
 *   3. RE-READS the order, its FulfillmentLog and its engine jobs INSIDE the lock and decides (`decideSupplierPurchase`);
 *   4. if the purchase may go ahead, writes the durable claim — `FulfillmentLog.status = BUYING` — and commits. The lock is
 *      released by the commit, but the claim is now visible to everybody: the supplier call (slow, network) happens AFTER
 *      the commit, never inside a transaction.
 *
 * Outcome handling (what keeps a lost answer from becoming a second purchase):
 *   - supplier answered with an order id  → the caller records it, `markSupplierPurchasePlaced` moves the claim to BOUGHT;
 *   - supplier DEFINITIVELY refused       → `releaseSupplierPurchase` moves the claim to FAILED (a retry may buy again). Only an
 *     explicit, RECOGNISED refusal is definitive (`classifyPlaceOrderAnswer`, an allow-list);
 *   - outcome UNKNOWN (timeout, unreadable / non-2xx answer, unknown gateway error, anything not on that list) → the claim stays
 *     BUYING and the order is never sent again. Replays see "in progress" and do nothing (read-only); `reportInDoubtPurchase`
 *     alerts (Sentry AND the ops webhook — the BullMQ worker never initialises Sentry). A BUYING claim never expires into a
 *     new purchase;
 *   - the PROCESS DIES between the claim and the answer → nobody is left to alert: the `sentinel-scan` cron
 *     (`lib/sentinel/collectors/purchase-in-doubt.ts`) raises a P0 for every claim older than `PURCHASE_IN_DOUBT_AFTER_MS`.
 *
 * No schema change: the claim is the existing `FulfillmentLog` row (`orderId @unique`), which `auto-buy.ts` already used.
 */

import { captureException } from "@sentry/nextjs"

import {
  evaluateAutoBuyMargin,
  formatAutoBuyMarginRefusal,
  type AutoBuyMarginCost,
  type AutoBuyMarginDecision,
} from "@/lib/fulfillment/auto-buy-margin"
import { ENGINE_JOB_ATTRIBUTION_SELECT, jobAttributionOf } from "@/lib/fulfillment/engine-job-attribution"
import { resolveManualSupplierSku } from "@/lib/fulfillment/resolve-manual-supplier-sku"
import { resolveSupplierSkuForOrder } from "@/lib/fulfillment/resolve-supplier-sku"
import {
  decideSupplierPurchase,
  PURCHASE_IN_DOUBT_AFTER_MS,
  type PurchaseDecision,
} from "@/lib/fulfillment/supplier-purchase-decision"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/** Advisory-lock namespace — one key per ORDER, shared by the three AliExpress paths. */
export const SUPPLIER_PURCHASE_LOCK_PREFIX = "affisell:supplier-purchase:"

const CLAIM_TX_OPTIONS = { timeout: 15_000, maxWait: 15_000 } as const

export type SupplierPurchasePath = "auto_buy" | "engine" | "order_paid"

export type MarginRefusal = Extract<AutoBuyMarginDecision, { allowed: false }>

export type SupplierPurchaseVerdict =
  | { kind: "go"; orderId: string; attempt: number }
  | { kind: "already_placed"; orderId: string; supplierOrderId: string; evidence: "order" | "log" | "job" }
  | { kind: "in_progress"; orderId: string; stale: boolean }
  | { kind: "not_purchasable"; orderId: string; orderStatus: string; reason: "order_status" | "refunded" }
  | { kind: "order_not_found"; orderId: string }
  | { kind: "margin_refused"; orderId: string; decision: MarginRefusal }

const CLAIM_SELECT = {
  id: true,
  status: true,
  supplierOrderId: true,
  autoBuyLog: { select: { status: true, aeOrderId: true, attempts: true, updatedAt: true } },
  supplierFulfillmentLinks: {
    select: {
      supplierFulfillmentOrder: {
        select: {
          id: true,
          supplierOrderId: true,
          status: true,
          // Which order the job's supplier order id belongs to depends on the provider: see `engine-job-attribution.ts`.
          ...ENGINE_JOB_ATTRIBUTION_SELECT,
        },
      },
    },
  },
} satisfies Prisma.OrderSelect

const MARGIN_ORDER_SELECT = {
  id: true,
  quantity: true,
  variantLabel: true,
  basePriceCents: true,
  sellingPriceCents: true,
  subtotalCents: true,
  taxCents: true,
  totalCents: true,
  affiliatePayoutCents: true,
  affiliateMarginRetainedCents: true,
  affisellFeeCents: true,
  affiliateFeeCents: true,
  supplierFeeCents: true,
  usesAffisellAutoBuy: true,
  aeWholesaleCents: true,
  supplierPriceCents: true,
  affiliateMarginCents: true,
  supplierCommissionRateBps: true,
  affisellCommissionRateBps: true,
  supplierPayoutCents: true,
  commissionCents: true,
  product: {
    select: {
      supplierSku: true,
      supplierWholesaleCents: true,
      variantMapping: true,
      supplierLink: { include: { variantMappings: true } },
      productVariants: {
        select: {
          id: true,
          color: true,
          size: true,
          attributes: true,
          supplierSku: true,
          wholesalePriceCents: true,
        },
      },
    },
  },
} satisfies Prisma.OrderSelect

type MarginOrderRow = Prisma.OrderGetPayload<{ select: typeof MARGIN_ORDER_SELECT }>

/**
 * AE cost of the SKU that will be bought, resolved EXACTLY like `auto-buy.ts` does (variant mapping → link default,
 * then a manually entered supplier SKU when the mapping is unmatched). No supplier link = cost unknown (fail closed).
 */
export function resolveAeCostForOrderRow(row: MarginOrderRow): AutoBuyMarginCost {
  const link = row.product.supplierLink
  if (!link) return { aeUnitPriceCents: null, aeShippingCents: null }

  let resolved = resolveSupplierSkuForOrder(
    { aeSkuId: link.aeSkuId, aePriceCents: link.aePriceCents, aeShippingCents: link.aeShippingCents },
    link.variantMappings,
    { variantLabel: row.variantLabel, quantity: row.quantity },
    row.product.productVariants
  )
  const manual = resolveManualSupplierSku(
    {
      supplierSku: row.product.supplierSku,
      supplierWholesaleCents: row.product.supplierWholesaleCents,
      variantMapping: row.product.variantMapping,
      productVariants: row.product.productVariants,
    },
    { variantLabel: row.variantLabel },
    link.aePriceCents,
    link.aeShippingCents
  )
  if (manual && (!resolved.aeSkuId || resolved.source === "unmatched")) resolved = manual
  return { aeUnitPriceCents: resolved.aePriceCents, aeShippingCents: resolved.aeShippingCents }
}

function verdictFromDecision(orderId: string, decision: Exclude<PurchaseDecision, { kind: "claim" }>): SupplierPurchaseVerdict {
  switch (decision.kind) {
    case "already_placed":
      return { kind: "already_placed", orderId, supplierOrderId: decision.supplierOrderId, evidence: decision.evidence }
    case "in_progress":
      return { kind: "in_progress", orderId, stale: decision.stale }
    case "not_purchasable":
      return { kind: "not_purchasable", orderId, orderStatus: decision.orderStatus, reason: decision.reason }
  }
}

/**
 * Ask permission to buy for ONE order. Returns `go` for exactly one of any number of concurrent callers; everybody else
 * gets a non-`go` verdict and must not contact the supplier. Throws only on database failure — which also means "no
 * purchase" (callers must treat an exception as "do not buy").
 */
export async function authorizeSupplierPurchase(args: {
  orderId: string
  path: SupplierPurchasePath
  /**
   * Cost of the SKU the caller is about to buy. Omit it to have it resolved here from the order's SupplierLink (the
   * generic engine does not resolve a SKU itself).
   */
  cost?: AutoBuyMarginCost
  now?: Date
}): Promise<SupplierPurchaseVerdict> {
  const { orderId, path } = args
  const now = args.now ?? new Date()

  // The money inputs are an immutable snapshot of the sale plus the AE cost: reading them outside the lock is safe.
  const marginRow = await prisma.order.findUnique({ where: { id: orderId }, select: MARGIN_ORDER_SELECT })
  if (!marginRow) return { kind: "order_not_found", orderId }
  const margin = evaluateAutoBuyMargin(marginRow, args.cost ?? resolveAeCostForOrderRow(marginRow))

  const verdict = await prisma.$transaction(async (tx): Promise<SupplierPurchaseVerdict> => {
    // Serialises every path (and every worker) that wants to buy for THIS order. Released at commit/rollback.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${SUPPLIER_PURCHASE_LOCK_PREFIX}${orderId}`}))`

    // Re-read INSIDE the lock: the snapshot that decides must be the one nobody can change until we commit.
    const row = await tx.order.findUnique({ where: { id: orderId }, select: CLAIM_SELECT })
    if (!row) return { kind: "order_not_found", orderId }

    const decision = decideSupplierPurchase(
      {
        orderId: row.id,
        status: row.status,
        supplierOrderId: row.supplierOrderId,
        log: row.autoBuyLog,
        jobs: row.supplierFulfillmentLinks.map((l) => ({
          id: l.supplierFulfillmentOrder.id,
          supplierOrderId: l.supplierFulfillmentOrder.supplierOrderId,
          status: l.supplierFulfillmentOrder.status,
          ...jobAttributionOf(l.supplierFulfillmentOrder),
        })),
      },
      now
    )
    if (decision.kind !== "claim") return verdictFromDecision(orderId, decision)

    // Fail closed: a loss-making sale or an unknown cost is refused BEFORE anything is claimed or spent.
    if (!margin.allowed) return { kind: "margin_refused", orderId, decision: margin }

    await tx.fulfillmentLog.upsert({
      where: { orderId },
      create: { orderId, orderItemId: orderId, status: "BUYING", attempts: decision.attempt },
      update: { status: "BUYING", attempts: decision.attempt, errorMsg: null },
    })
    return { kind: "go", orderId, attempt: decision.attempt }
  }, CLAIM_TX_OPTIONS)

  if (verdict.kind === "margin_refused") {
    await reportMarginRefusal(orderId, path, verdict.decision)
  } else if (verdict.kind === "in_progress" && verdict.stale) {
    await reportInDoubtPurchase({ orderId, path, reason: "stale_claim" })
  } else if (verdict.kind === "already_placed" || verdict.kind === "in_progress") {
    console.log("[supplier-purchase]", {
      result: verdict.kind === "in_progress" ? "in_progress_replay" : "already_placed_skip",
      orderId,
      path,
    })
  }
  return verdict
}

/** The supplier answered with an order id. Never throws: the purchase HAPPENED, the caller must still record it. */
export async function markSupplierPurchasePlaced(orderId: string, supplierOrderId: string): Promise<void> {
  try {
    await prisma.fulfillmentLog.updateMany({
      where: { orderId },
      data: { status: "BOUGHT", aeOrderId: supplierOrderId, errorMsg: null },
    })
  } catch (e) {
    // The claim stays BUYING: every replay is refused ("in progress") — safe, but a human must know the order id.
    await reportInDoubtPurchase({
      orderId,
      path: "engine",
      reason: "placed_but_unrecorded",
      supplierOrderId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * The supplier DEFINITIVELY did not create an order (clear business refusal, nothing was sent): free the claim so a
 * retry may buy. Never call it after an ambiguous failure. Never throws (a failed release only keeps the claim: safe).
 */
export async function releaseSupplierPurchase(orderId: string, errorMsg: string): Promise<void> {
  try {
    // Conditional: only the claim THIS caller holds (BUYING) is released — never a log another path already settled.
    await prisma.fulfillmentLog.updateMany({
      where: { orderId, status: "BUYING" },
      data: { status: "FAILED", errorMsg: errorMsg.slice(0, 2000) },
    })
  } catch (e) {
    console.error("[supplier-purchase]", {
      result: "release_failed_claim_kept",
      orderId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * Ops alert (Slack / Discord webhook). Sentry alone is not enough: the BullMQ worker process that runs the purchases
 * (`workers/auto-order-worker.ts`) never initialises Sentry, so a `captureException` there goes nowhere. Bounded (3 s) and
 * never throws — alerting must not hold up or break a purchase flow.
 */
async function sendOpsAlert(text: string): Promise<void> {
  try {
    await Promise.race([
      opsWebhookAlert(text),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 3_000).unref?.()
      }),
    ])
  } catch {
    /* alerting must never break the flow */
  }
}

/** Trace + alert + hand-off to a human for a refused margin. Never throws. */
export async function reportMarginRefusal(
  orderId: string,
  path: SupplierPurchasePath,
  decision: MarginRefusal
): Promise<void> {
  const message = formatAutoBuyMarginRefusal(decision)
  console.warn("[auto-buy-margin]", {
    result: "refused",
    orderId,
    path,
    reason: decision.reason,
    marginCents: decision.marginCents,
    floorCents: decision.floorCents,
    breakdown: decision.breakdown,
  })
  try {
    captureException(new Error(message), {
      level: "warning",
      tags: { module: "auto-buy-margin", reason: decision.reason, path },
      extra: { orderId, marginCents: decision.marginCents, floorCents: decision.floorCents, breakdown: decision.breakdown },
    })
  } catch {
    /* alerting must never break the flow */
  }
  // The remedy depends on the reason: an UNKNOWN cost is fixed by entering it (lowering the floor or the price changes nothing).
  const remedy =
    decision.reason === "cost_unknown"
      ? `Cout AliExpress INCONNU (${decision.unknownCost?.join(" + ") ?? "prix / port"} a 0 ou absent sur le lien produit) : ` +
        `renseigner le cout reel sur le SupplierLink (liste : GET /api/admin/auto-fulfill/links-missing-cost), puis relancer via ` +
        `POST /api/orders/${orderId}/fulfill.`
      : decision.reason === "revenue_unknown"
        ? "Montant de la vente inconnu sur la commande : a verifier a la main."
        : "Marge insuffisante : ajuster le prix de vente ou le plancher AUTO_BUY_MIN_MARGIN_CENTS, ou acheter a la main, ou rembourser."
  await sendOpsAlert(
    `Affisell - achat AliExpress REFUSE : commande ${orderId} (${path}). ${message}. ` +
      `L'acheteur a paye : decision humaine requise. ${remedy}`
  )
  await flagOrderForManualHandling(orderId, { margin: message, path, at: new Date().toISOString() })
}

/** Purchase outcome unknown: alert + hand-off to a human. The claim is NOT touched (it keeps blocking). Never throws. */
export async function reportInDoubtPurchase(info: {
  orderId: string
  path: SupplierPurchasePath
  reason: "stale_claim" | "supplier_outcome_uncertain" | "placed_but_unrecorded"
  /** Only for `placed_but_unrecorded`: the id AliExpress returned (it is not stored anywhere else). */
  supplierOrderId?: string
  error?: string
}): Promise<void> {
  console.error("[supplier-purchase]", {
    result: "in_doubt",
    orderId: info.orderId,
    path: info.path,
    reason: info.reason,
    supplierOrderIdTail: info.supplierOrderId ? info.supplierOrderId.slice(-6) : undefined,
    error: info.error,
  })
  try {
    captureException(new Error(`SUPPLIER_PURCHASE_IN_DOUBT:${info.reason}`), {
      tags: { module: "supplier-purchase-guard", reason: info.reason, path: info.path },
      extra: { orderId: info.orderId, supplierOrderId: info.supplierOrderId, error: info.error },
    })
  } catch {
    /* alerting must never break the flow */
  }
  await sendOpsAlert(
    `Affisell - ACHAT ALIEXPRESS EN DOUTE (${info.reason}) : commande ${info.orderId} (${info.path}). ` +
      `Une commande peut exister chez AliExpress : verifier la liste des commandes AliExpress AVANT toute relance ou tout remboursement. ` +
      (info.supplierOrderId ? `Identifiant AliExpress recu : ${info.supplierOrderId} (a reporter sur Order.supplierOrderId). ` : "") +
      (info.error ? `Detail : ${info.error.slice(0, 300)}` : "")
  )
  await flagOrderForManualHandling(info.orderId, {
    purchase_in_doubt: info.reason,
    path: info.path,
    at: new Date().toISOString(),
    ...(info.supplierOrderId ? { supplierOrderId: info.supplierOrderId } : {}),
  })
}

/**
 * Replay-time detection for the paths that answer "in progress" without going through `authorizeSupplierPurchase`
 * (the `order.paid` fast path): a claim older than `PURCHASE_IN_DOUBT_AFTER_MS` is reported. Never throws.
 */
export async function reportStaleClaimIfOld(orderId: string, path: SupplierPurchasePath, claimUpdatedAt: Date | null): Promise<void> {
  if (!claimUpdatedAt || Date.now() - claimUpdatedAt.getTime() <= PURCHASE_IN_DOUBT_AFTER_MS) return
  await reportInDoubtPurchase({ orderId, path, reason: "stale_claim" })
}

async function flagOrderForManualHandling(orderId: string, trace: Record<string, string>): Promise<void> {
  try {
    // Append to what is already there (the supplier's own error, an earlier flag): a trace must not erase another one.
    const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { fulfillmentErrors: true } })
    const prior = Array.isArray(existing?.fulfillmentErrors) ? existing.fulfillmentErrors : []
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: "MANUAL_REQUIRED",
        fulfillmentErrors: [...prior.slice(-9), trace] as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.error("[supplier-purchase]", {
      result: "manual_flag_failed",
      orderId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
