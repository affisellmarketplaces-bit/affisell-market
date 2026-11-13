import type Stripe from "stripe"
import { captureException } from "@sentry/nextjs"

import { AliExpressClient } from "@/lib/aliexpress-open-api"
import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import { placeAliExpressDsOrder } from "@/lib/fulfillment/ae-ds-order"
import { enqueueAutoBuyJob } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { acquireAutoBuyRateLimit } from "@/lib/fulfillment/rate-limit"
import {
  autoBuyCardAmountCents,
  createAutoBuyVirtualCard,
  freezeAutoBuyVirtualCard,
  loadAutoBuyVirtualCardSecrets,
} from "@/lib/fulfillment/stripe-issuing-card"
import { parseShipping } from "@/lib/fulfillment/shipping-address"
import { mergeAeVariantMappingForOrder } from "@/lib/fulfillment/merge-ae-variant-mapping"
import { resolveManualSupplierSku } from "@/lib/fulfillment/resolve-manual-supplier-sku"
import { resolveSupplierSkuForOrder } from "@/lib/fulfillment/resolve-supplier-sku"
import { formatAutoBuyMarginRefusal } from "@/lib/fulfillment/auto-buy-margin"
import {
  authorizeSupplierPurchase,
  reportInDoubtPurchase,
  type SupplierPurchaseVerdict,
} from "@/lib/fulfillment/supplier-purchase-guard"
import { PURCHASE_IN_DOUBT_AFTER_MS } from "@/lib/fulfillment/supplier-purchase-decision"
import { initiateMarketplaceRefundPipeline } from "@/lib/marketplace-refund-pipeline"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import { prisma } from "@/lib/prisma"
export const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 10 * 60 * 1000
export const MAX_DAILY_ORDERS = 1000
export const MAX_ORDER_VALUE_EUR = 500

function startOfTodayUtc(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Auto-buy spends Affisell's own money (an AliExpress order paid with a single-use Stripe Issuing card), so it is
 * OPT-IN: it stays off unless `AUTO_BUY_ENABLED=true` is set on the server. The legacy kill switches
 * (`DISABLE_AUTO_BUY=true`, `AUTO_ORDER_ENABLED=false`) still win over the opt-in.
 *
 * Owner decision (2026-11-13): no autonomous purchase may run without a specific business and financial validation.
 * It used to be opt-out (running unless `DISABLE_AUTO_BUY=true`), which left real purchases one forgotten variable away.
 */
export function isAutoBuyDisabled(): boolean {
  if (process.env.DISABLE_AUTO_BUY === "true" || process.env.AUTO_ORDER_ENABLED === "false") return true
  return process.env.AUTO_BUY_ENABLED !== "true"
}

function logAutoBuy(metric: string, payload: Record<string, unknown>) {
  console.log("[auto-buy]", { metric, ...payload })
}

/** Idempotent FulfillmentLog rows for paid session lines with active SupplierLink. */
export async function enqueueAutoBuyForStripeSession(stripeSessionId: string): Promise<string[]> {
  if (isAutoBuyDisabled()) {
    logAutoBuy("disabled", { stripeSessionId })
    return []
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId }, { stripeSessionId: { startsWith: `${stripeSessionId}:line:` } }],
      status: "paid",
    },
    include: {
      product: {
        include: {
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
      autoBuyLog: { select: { id: true, status: true, attempts: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const logIds: string[] = []

  for (const order of orders) {
    if (order.autoBuyLog) {
      logIds.push(order.autoBuyLog.id)
      if (
        order.autoBuyLog.status === "PENDING" ||
        (order.autoBuyLog.status === "FAILED" && order.autoBuyLog.attempts < MAX_ATTEMPTS)
      ) {
        await enqueueAutoBuyJob({ fulfillmentLogId: order.autoBuyLog.id }).catch((e) => {
          console.error("[auto-buy] re_enqueue_failed", {
            orderId: order.id,
            error: e instanceof Error ? e.message : String(e),
          })
        })
      }
      continue
    }

    const link = order.product.supplierLink
    if (!link?.isActive || !link.autoBuyEnabled) {
      if (!link) {
        await prisma.fulfillmentLog.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            orderItemId: order.id,
            status: "FAILED",
            errorMsg: "NO_SUPPLIER_LINK",
            attempts: 0,
          },
          update: {},
        })
        logAutoBuy("no_supplier_link", { orderId: order.id })
      }
      continue
    }

    const log = await prisma.fulfillmentLog.create({
      data: {
        orderId: order.id,
        orderItemId: order.id,
        status: "PENDING",
      },
    })
    logIds.push(log.id)
    logAutoBuy("log_created", { orderId: order.id, fulfillmentLogId: log.id })

    try {
      await enqueueAutoBuyJob({ fulfillmentLogId: log.id })
    } catch (e) {
      console.error("[auto-buy] queue_enqueue_failed", {
        orderId: order.id,
        error: e instanceof Error ? e.message : String(e),
      })
      captureException(e, { tags: { module: "auto-buy" }, extra: { orderId: order.id } })
    }
  }

  return logIds
}

export async function triggerAutoBuyForPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  if (isAutoBuyDisabled() || pi.metadata?.flow === "blind_dropship") return

  const orders = await prisma.order.findMany({
    where: { stripePaymentIntentId: pi.id, status: "paid" },
    select: { stripeSessionId: true },
    distinct: ["stripeSessionId"],
  })

  const sessions = new Set<string>()
  for (const o of orders) {
    const base = o.stripeSessionId.split(":line:")[0] ?? o.stripeSessionId
    sessions.add(base)
  }

  for (const sessionId of sessions) {
    await enqueueAutoBuyForStripeSession(sessionId)
  }
}

export async function processAutoBuyFulfillmentLog(fulfillmentLogId: string): Promise<void> {
  if (isAutoBuyDisabled()) return

  const rate = await acquireAutoBuyRateLimit()
  if (!rate.ok) {
    await enqueueAutoBuyJob({ fulfillmentLogId }, { delayMs: rate.retryAfterMs })
    return
  }

  const log = await prisma.fulfillmentLog.findUnique({
    where: { id: fulfillmentLogId },
    include: {
      order: {
        select: {
          id: true,
          variantLabel: true,
          quantity: true,
          shippingAddress: true,
          totalCents: true,
          sellingPriceCents: true,
          supplierFeeCents: true,
          affiliateFeeCents: true,
          aeWholesaleCents: true,
          product: {
            include: {
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
        },
      },
    },
  })

  if (!log) return
  if (log.status === "BOUGHT" || log.status === "REFUNDED") return

  // A claim is in flight (or its outcome was never recorded): replay in READ mode. Never fall through to the checks below —
  // a late failure there would overwrite the BUYING claim with FAILED and let a retry buy a second time.
  if (log.status === "BUYING") {
    logAutoBuy("in_progress_replay", { orderId: log.orderId, fulfillmentLogId: log.id })
    if (Date.now() - log.updatedAt.getTime() > PURCHASE_IN_DOUBT_AFTER_MS) {
      await reportInDoubtPurchase({ orderId: log.orderId, path: "auto_buy", reason: "stale_claim" })
    }
    return
  }

  // Already placed via /api/orders/[id]/fulfill or order.paid worker
  const existingSupplierOrderId = await prisma.order.findUnique({
    where: { id: log.orderId },
    select: { supplierOrderId: true },
  })
  if (existingSupplierOrderId?.supplierOrderId) {
    await prisma.fulfillmentLog.update({
      where: { id: log.id },
      data: {
        status: "BOUGHT",
        aeOrderId: existingSupplierOrderId.supplierOrderId,
        errorMsg: null,
      },
    })
    logAutoBuy("already_supplier_ordered", {
      orderId: log.orderId,
      supplierOrderIdTail: existingSupplierOrderId.supplierOrderId.slice(-6),
    })
    return
  }

  const todayOrders = await prisma.fulfillmentLog.count({
    where: {
      status: "BOUGHT",
      createdAt: { gte: startOfTodayUtc() },
      NOT: { aeOrderId: { startsWith: "DRY_RUN_" } },
    },
  })

  if (todayOrders >= MAX_DAILY_ORDERS) {
    await prisma.fulfillmentLog.update({
      where: { id: fulfillmentLogId },
      data: {
        status: "FAILED",
        errorMsg: `DAILY_ORDER_LIMIT_REACHED: ${MAX_DAILY_ORDERS} commandes max`,
      },
    })
    logAutoBuy("daily_limit_reached", { fulfillmentLogId, todayOrders })
    throw new Error("DAILY_ORDER_LIMIT_REACHED")
  }

  const link = log.order.product.supplierLink
  const productAutoBuy =
    log.order.product.autoBuyEnabled || log.order.product.autoFulfill
  if (!link?.isActive || (!link.autoBuyEnabled && !productAutoBuy)) {
    await prisma.fulfillmentLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMsg: "NO_SUPPLIER_LINK" },
    })
    return
  }

  // The BUYING claim is taken later, by `authorizeSupplierPurchase` (lock + re-read + margin). `failAutoBuy` persists
  // `attempts`, so a failure before the claim still counts.
  const nextAttempt = log.attempts + 1

  const shippingAddress = parseShipping(log.order.shippingAddress)
  let resolvedSku = resolveSupplierSkuForOrder(
    {
      aeSkuId: link.aeSkuId,
      aePriceCents: link.aePriceCents,
      aeShippingCents: link.aeShippingCents,
    },
    link.variantMappings,
    {
      variantLabel: log.order.variantLabel,
      quantity: log.order.quantity,
    },
    log.order.product.productVariants
  )

  const manualSku = resolveManualSupplierSku(
    {
      supplierSku: log.order.product.supplierSku,
      supplierWholesaleCents: log.order.product.supplierWholesaleCents,
      variantMapping: log.order.product.variantMapping,
      productVariants: log.order.product.productVariants,
    },
    { variantLabel: log.order.variantLabel },
    link.aePriceCents,
    link.aeShippingCents
  )
  if (manualSku && (!resolvedSku.aeSkuId || resolvedSku.source === "unmatched")) {
    resolvedSku = manualSku
  }

  const { mapping: aeVariantMapping } = mergeAeVariantMappingForOrder({
    productVariantMapping: log.order.product.variantMapping,
    productVariants: log.order.product.productVariants,
    order: { variantLabel: log.order.variantLabel },
  })

  if (
    link.variantMappings.length > 0 &&
    (resolvedSku.source === "unmatched" || !resolvedSku.aeSkuId) &&
    !manualSku?.aeSkuId
  ) {
    await failAutoBuy(
      log.id,
      log.orderId,
      `VARIANT_SKU_UNMATCHED:${log.order.variantLabel ?? ""}`,
      nextAttempt
    )
    logAutoBuy("variant_sku_unmatched", {
      orderId: log.orderId,
      variantLabel: log.order.variantLabel,
      mappingCount: link.variantMappings.length,
    })
    return
  }

  const aeSkuId = resolvedSku.aeSkuId ?? link.aeSkuId
  const amountCents = autoBuyCardAmountCents(
    resolvedSku.aePriceCents,
    resolvedSku.aeShippingCents
  )

  const clientTotalCents =
    log.order.totalCents ??
    log.order.sellingPriceCents ??
    amountCents * log.order.quantity

  logAutoBuy("sku_resolved", {
    orderId: log.orderId,
    source: resolvedSku.source,
    aeSkuId,
    amountCents,
    clientTotalCents,
    supplierFeeCents: log.order.supplierFeeCents,
    affiliateFeeCents: log.order.affiliateFeeCents,
    aeWholesaleCents: log.order.aeWholesaleCents,
  })

  if (clientTotalCents > MAX_ORDER_VALUE_EUR * 100) {
    await prisma.fulfillmentLog.update({
      where: { id: fulfillmentLogId },
      data: {
        status: "FAILED",
        errorMsg: `ORDER_VALUE_TOO_HIGH: ${(clientTotalCents / 100).toFixed(2)}€ > ${MAX_ORDER_VALUE_EUR}€`,
      },
    })
    logAutoBuy("order_value_too_high", { fulfillmentLogId, clientTotalCents })
    throw new Error("ORDER_VALUE_TOO_HIGH")
  }

  // THE gate (G2 + G3). From here on, anything that spends money happens only for the ONE caller that gets "go".
  const verdict = await authorizeSupplierPurchase({
    orderId: log.orderId,
    path: "auto_buy",
    cost: { aeUnitPriceCents: resolvedSku.aePriceCents, aeShippingCents: resolvedSku.aeShippingCents },
  })
  if (verdict.kind !== "go") {
    await settleRefusedAutoBuy(log.id, log.orderId, verdict)
    return
  }
  const attemptNo = verdict.attempt

  if (isAeDryRun()) {
    await completeAutoBuyDryRun({
      fulfillmentLogId: log.id,
      orderId: log.orderId,
      aeSkuId,
      quantity: log.order.quantity,
      shippingName: shippingAddress.name ?? null,
      aeWholesaleCents: resolvedSku.aePriceCents * log.order.quantity,
    })
    return
  }

  let virtualCardId: string | null = log.virtualCardId
  let cardNumber = ""
  let cardExpMonth = 0
  let cardExpYear = 0
  let cardCvc = ""

  if (virtualCardId && !cardNumber) {
    const loaded = await loadAutoBuyVirtualCardSecrets(virtualCardId)
    if (loaded.ok) {
      cardNumber = loaded.number
      cardExpMonth = loaded.expMonth
      cardExpYear = loaded.expYear
      cardCvc = loaded.cvc
    }
  }

  if (!virtualCardId || !cardNumber) {
    const card = await createAutoBuyVirtualCard(amountCents)
    if (!card.ok) {
      await failAutoBuy(log.id, log.orderId, card.error, attemptNo)
      return
    }
    virtualCardId = card.cardId
    cardNumber = card.number
    cardExpMonth = card.expMonth
    cardExpYear = card.expYear
    cardCvc = card.cvc
    try {
      await prisma.fulfillmentLog.update({
        where: { id: log.id },
        data: { virtualCardId },
      })
    } catch (e) {
      // Nothing was sent to AliExpress yet: a definitive failure (the claim is released), not an "in doubt" purchase.
      await failAutoBuy(
        log.id,
        log.orderId,
        `CARD_LOG_WRITE_FAILED:${e instanceof Error ? e.message : String(e)}`,
        attemptNo,
        virtualCardId
      )
      return
    }
  }

  const ds = await placeAliExpressDsOrder({
    aeProductId: link.aeProductId,
    aeSkuId,
    quantity: log.order.quantity,
    shippingAddress,
  })

  let aeOrderId: string | null = null
  let aeTracking: string | null = null

  if (ds.ok) {
    aeOrderId = ds.aeOrderId
  } else if (ds.outcomeUncertain) {
    // The request left and its outcome is unknown: AliExpress may have created the order. Trying the browser checkout, or
    // retrying, could buy twice. Keep the BUYING claim, alert, and let a human check the AliExpress order list.
    await holdAutoBuyInDoubt(log.id, log.orderId, ds.error, virtualCardId)
    return
  } else if (virtualCardId && cardNumber) {
    const { runAliExpressBrowserCheckout } = await import("@/lib/fulfillment/ae-browser-checkout")
    const browser = await runAliExpressBrowserCheckout({
      aeUrl: link.aeUrl,
      aeSkuId,
      supplierUrl: log.order.product.sourceUrl ?? link.aeUrl,
      variantMapping: Object.keys(aeVariantMapping).length > 0 ? aeVariantMapping : null,
      quantity: log.order.quantity,
      shippingAddress,
      cardNumber,
      cardExpMonth,
      cardExpYear,
      cardCvc,
    })
    if (!browser.ok) {
      await failAutoBuy(log.id, log.orderId, `${ds.error}; ${browser.error}`, attemptNo, virtualCardId)
      return
    }
    aeOrderId = browser.aeOrderId
    aeTracking = browser.aeTracking
  } else {
    await failAutoBuy(log.id, log.orderId, ds.error, attemptNo, virtualCardId)
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.fulfillmentLog.update({
        where: { id: log.id },
        data: {
          status: "BOUGHT",
          aeOrderId,
          aeTracking,
          errorMsg: null,
        },
      })
      const aeWholesaleSnapshot = Math.max(0, resolvedSku.aePriceCents * log.order.quantity)
      await tx.order.update({
        where: { id: log.orderId },
        data: {
          supplierOrderId: aeOrderId,
          status: "fulfilling",
          fulfilledAt: new Date(),
          fulfillmentStatus: "ORDERED",
          supplierPreparingAt: new Date(),
          aeWholesaleCents: log.order.aeWholesaleCents ?? aeWholesaleSnapshot,
        },
      })
    })
  } catch (e) {
    // The order EXISTS at AliExpress but could not be written down: the claim stays BUYING (every replay is refused, so no
    // second purchase) and the AliExpress id goes to the alert — it is stored nowhere else.
    await reportInDoubtPurchase({
      orderId: log.orderId,
      path: "auto_buy",
      reason: "placed_but_unrecorded",
      supplierOrderId: aeOrderId ?? undefined,
      error: e instanceof Error ? e.message : String(e),
    })
    return
  }

  if (virtualCardId) await freezeAutoBuyVirtualCard(virtualCardId)

  logAutoBuy("bought", { orderId: log.orderId, aeOrderId, fulfillmentLogId: log.id })
  const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
  triggerOrderTransferRelease(log.orderId)
}

type AutoBuyDryRunInput = {
  fulfillmentLogId: string
  orderId: string
  aeSkuId: string | null
  quantity: number
  shippingName: string | null
  aeWholesaleCents?: number | null
}

/** Skip Stripe Issuing + AE order commit; mark log BOUGHT for pipeline testing. */
async function completeAutoBuyDryRun(input: AutoBuyDryRunInput): Promise<{ success: true; dryRun: true }> {
  const dryRunOrderId = `DRY_RUN_${Date.now()}`

  console.log("[auto-buy] DRY_RUN enabled - stopping before payment")
  console.log("[auto-buy] Would have paid with card •••• 0005")
  console.log("[auto-buy] Product:", input.aeSkuId, "Qty:", input.quantity)
  console.log("[auto-buy] Shipping to:", input.shippingName ?? "(unknown)")

  await prisma.$transaction(async (tx) => {
    await tx.fulfillmentLog.update({
      where: { id: input.fulfillmentLogId },
      data: {
        status: "BOUGHT",
        aeOrderId: dryRunOrderId,
        errorMsg: "DRY_RUN - payment skipped",
      },
    })
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        supplierOrderId: dryRunOrderId,
        status: "fulfilling",
        fulfilledAt: new Date(),
        fulfillmentStatus: "ORDERED",
        supplierPreparingAt: new Date(),
        ...(input.aeWholesaleCents != null && input.aeWholesaleCents > 0
          ? { aeWholesaleCents: input.aeWholesaleCents }
          : {}),
      },
    })
  })

  logAutoBuy("dry_run_complete", {
    fulfillmentLogId: input.fulfillmentLogId,
    orderId: input.orderId,
    aeOrderId: dryRunOrderId,
    aeSkuId: input.aeSkuId,
    quantity: input.quantity,
  })

  return { success: true, dryRun: true }
}

/** The guard said "no": settle the FulfillmentLog without touching the supplier, and without retry nor refund. */
async function settleRefusedAutoBuy(
  fulfillmentLogId: string,
  orderId: string,
  verdict: Exclude<SupplierPurchaseVerdict, { kind: "go" }>
): Promise<void> {
  switch (verdict.kind) {
    case "already_placed":
      // Another path (generic engine, order.paid, manual fulfil) already bought it: mirror it, as the unlocked check did.
      if (verdict.supplierOrderId !== "unknown") {
        await prisma.fulfillmentLog.update({
          where: { id: fulfillmentLogId },
          data: { status: "BOUGHT", aeOrderId: verdict.supplierOrderId, errorMsg: null },
        })
      }
      logAutoBuy("already_supplier_ordered", {
        orderId,
        evidence: verdict.evidence,
        supplierOrderIdTail: verdict.supplierOrderId.slice(-6),
      })
      return
    case "in_progress":
      logAutoBuy("claim_in_progress", { orderId, stale: verdict.stale })
      return
    case "not_purchasable":
      await prisma.fulfillmentLog.update({
        where: { id: fulfillmentLogId },
        data: { status: "FAILED", errorMsg: `ORDER_NOT_PURCHASABLE:${verdict.reason}:${verdict.orderStatus}` },
      })
      logAutoBuy("not_purchasable", { orderId, orderStatus: verdict.orderStatus, reason: verdict.reason })
      return
    case "order_not_found":
      logAutoBuy("order_not_found", { orderId })
      return
    case "margin_refused":
      // No retry, no refund: the buyer paid, the owner decides (price, floor, manual purchase or refund). The guard already
      // alerted and flagged the order for manual handling; this is the log's own trace.
      await prisma.fulfillmentLog.update({
        where: { id: fulfillmentLogId },
        data: { status: "FAILED", errorMsg: formatAutoBuyMarginRefusal(verdict.decision) },
      })
      logAutoBuy("margin_refused", { orderId, reason: verdict.decision.reason })
      return
  }
}

/** Outcome unknown: the BUYING claim is kept (it blocks every retry); only the card is frozen and a human is alerted. */
async function holdAutoBuyInDoubt(
  fulfillmentLogId: string,
  orderId: string,
  error: string,
  virtualCardId?: string | null
): Promise<void> {
  logAutoBuy("outcome_uncertain", { orderId, fulfillmentLogId, error })
  if (virtualCardId) {
    try {
      await freezeAutoBuyVirtualCard(virtualCardId)
    } catch (e) {
      console.error("[auto-buy] freeze_failed_in_doubt", { orderId, error: e instanceof Error ? e.message : String(e) })
    }
  }
  try {
    await prisma.fulfillmentLog.update({
      where: { id: fulfillmentLogId },
      data: { errorMsg: `OUTCOME_UNCERTAIN:${error}`.slice(0, 2000) },
    })
  } catch {
    /* the claim itself is what protects; the message is a convenience */
  }
  await reportInDoubtPurchase({ orderId, path: "auto_buy", reason: "supplier_outcome_uncertain", error })
}

async function failAutoBuy(
  fulfillmentLogId: string,
  orderId: string,
  errorMsg: string,
  attempts: number,
  virtualCardId?: string | null
): Promise<void> {
  logAutoBuy("failed", { orderId, fulfillmentLogId, errorMsg, attempts })
  captureException(new Error(errorMsg), {
    tags: { module: "auto-buy" },
    extra: { orderId, fulfillmentLogId, attempts },
  })

  if (virtualCardId) await freezeAutoBuyVirtualCard(virtualCardId)

  await prisma.fulfillmentLog.update({
    where: { id: fulfillmentLogId },
    data: { status: "FAILED", errorMsg: errorMsg.slice(0, 2000), attempts },
  })

  if (attempts < MAX_ATTEMPTS) {
    await enqueueAutoBuyJob({ fulfillmentLogId }, { delayMs: RETRY_DELAY_MS })
    return
  }

  const refund = await initiateMarketplaceRefundPipeline({
    orderId,
    source: "auto_buy_failure",
    reason: "requested_by_customer",
    metadata: { auto_buy: "stockout_after_retries" },
  })

  await prisma.fulfillmentLog.update({
    where: { id: fulfillmentLogId },
    data: {
      status: refund.ok ? "REFUNDED" : "FAILED",
      errorMsg: refund.ok ? "STOCKOUT_REFUNDED" : `REFUND_FAILED:${refund.error ?? refund.skipped}`,
    },
  })

  if (refund.ok) {
    await notifyOrderCancelled(orderId, {
      cancelReason: "Rupture stock fournisseur — remboursement en cours.",
      // `refund.ok` means Stripe accepted the refund, so its id is always there: "refunded" is only written then.
      stripeRefundId: refund.stripeRefundId,
    })
  }
}

export async function syncAutoBuyTracking(limit = 100): Promise<
  Array<{ fulfillmentLogId: string; updated: boolean; error?: string }>
> {
  const logs = await prisma.fulfillmentLog.findMany({
    where: {
      status: "BOUGHT",
      aeOrderId: { not: null },
      OR: [{ aeTracking: null }, { aeTracking: "" }],
    },
    take: limit,
    include: { order: { select: { id: true, customerEmail: true } } },
  })

  const results: Array<{ fulfillmentLogId: string; updated: boolean; error?: string }> = []

  for (const log of logs) {
    if (!log.aeOrderId) continue
    try {
      const tracking = await fetchAeTrackingPlaceholder(log.aeOrderId)
      if (!tracking) {
        results.push({ fulfillmentLogId: log.id, updated: false })
        continue
      }

      await prisma.$transaction(async (tx) => {
        await tx.fulfillmentLog.update({
          where: { id: log.id },
          data: { aeTracking: tracking.number },
        })
        await tx.order.update({
          where: { id: log.orderId },
          data: {
            trackingNumber: tracking.number,
            trackingCarrier: tracking.carrier ?? "AliExpress",
            shippedAt: new Date(),
            status: "shipped",
            fulfillmentStatus: "SHIPPED",
          },
        })
      })

      results.push({ fulfillmentLogId: log.id, updated: true })
      logAutoBuy("tracking_synced", { orderId: log.orderId, tracking: tracking.number })
      const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
      triggerOrderTransferRelease(log.orderId)
    } catch (e) {
      results.push({
        fulfillmentLogId: log.id,
        updated: false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return results
}

async function fetchAeTrackingPlaceholder(
  _aeOrderId: string
): Promise<{ number: string; carrier?: string } | null> {
  if (!AliExpressClient.isConfigured()) return null
  return null
}
