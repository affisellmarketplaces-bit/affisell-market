import type Stripe from "stripe"
import { captureException } from "@sentry/nextjs"

import { AliExpressClient } from "@/lib/aliexpress-open-api"
import { placeAliExpressDsOrder } from "@/lib/fulfillment/ae-ds-order"
import { runAliExpressBrowserCheckout } from "@/lib/fulfillment/ae-browser-checkout"
import { enqueueAutoBuyJob } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { acquireAutoBuyRateLimit } from "@/lib/fulfillment/rate-limit"
import {
  autoBuyCardAmountCents,
  createAutoBuyVirtualCard,
  freezeAutoBuyVirtualCard,
  loadAutoBuyVirtualCardSecrets,
} from "@/lib/fulfillment/stripe-issuing-card"
import { parseShipping } from "@/lib/fulfillment/shipping-address"
import { resolveSupplierSkuForOrder } from "@/lib/fulfillment/resolve-supplier-sku"
import { initiateMarketplaceOrderRefund } from "@/lib/stripe-refund-marketplace-order"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import { prisma } from "@/lib/prisma"
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 10 * 60 * 1000

export function isAutoBuyDisabled(): boolean {
  return (
    process.env.DISABLE_AUTO_BUY === "true" ||
    process.env.AUTO_ORDER_ENABLED === "false"
  )
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
          productVariants: { select: { id: true, color: true, size: true } },
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
        include: {
          product: {
            include: {
              supplierLink: { include: { variantMappings: true } },
              productVariants: { select: { id: true, color: true, size: true } },
            },
          },
        },
      },
    },
  })

  if (!log) return
  if (log.status === "BOUGHT" || log.status === "REFUNDED") return

  const link = log.order.product.supplierLink
  if (!link?.isActive || !link.autoBuyEnabled) {
    await prisma.fulfillmentLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMsg: "NO_SUPPLIER_LINK" },
    })
    return
  }

  const nextAttempt = log.attempts + 1
  await prisma.fulfillmentLog.update({
    where: { id: log.id },
    data: { status: "BUYING", attempts: nextAttempt },
  })

  const shippingAddress = parseShipping(log.order.shippingAddress)
  const resolvedSku = resolveSupplierSkuForOrder(
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

  if (
    link.variantMappings.length > 0 &&
    (resolvedSku.source === "unmatched" || !resolvedSku.aeSkuId)
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

  logAutoBuy("sku_resolved", {
    orderId: log.orderId,
    source: resolvedSku.source,
    aeSkuId,
    amountCents,
  })

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
      await failAutoBuy(log.id, log.orderId, card.error, nextAttempt)
      return
    }
    virtualCardId = card.cardId
    cardNumber = card.number
    cardExpMonth = card.expMonth
    cardExpYear = card.expYear
    cardCvc = card.cvc
    await prisma.fulfillmentLog.update({
      where: { id: log.id },
      data: { virtualCardId },
    })
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
  } else if (virtualCardId && cardNumber) {
    const browser = await runAliExpressBrowserCheckout({
      aeUrl: link.aeUrl,
      aeSkuId,
      shippingAddress,
      cardNumber,
      cardExpMonth,
      cardExpYear,
      cardCvc,
    })
    if (!browser.ok) {
      await failAutoBuy(log.id, log.orderId, `${ds.error}; ${browser.error}`, nextAttempt, virtualCardId)
      return
    }
    aeOrderId = browser.aeOrderId
    aeTracking = browser.aeTracking
  } else {
    await failAutoBuy(log.id, log.orderId, ds.error, nextAttempt, virtualCardId)
    return
  }

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
    await tx.order.update({
      where: { id: log.orderId },
      data: {
        fulfilledAt: new Date(),
        fulfillmentStatus: "ORDERED",
        supplierPreparingAt: new Date(),
      },
    })
  })

  if (virtualCardId) await freezeAutoBuyVirtualCard(virtualCardId)

  logAutoBuy("bought", { orderId: log.orderId, aeOrderId, fulfillmentLogId: log.id })
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
    data: { status: "FAILED", errorMsg: errorMsg.slice(0, 2000) },
  })

  if (attempts < MAX_ATTEMPTS) {
    await enqueueAutoBuyJob({ fulfillmentLogId }, { delayMs: RETRY_DELAY_MS })
    return
  }

  const refund = await initiateMarketplaceOrderRefund(orderId, {
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
      markRefunded: true,
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
