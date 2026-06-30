import type { Prisma } from "@prisma/client"

import { applySupplierPlaceOrderResult } from "@/lib/auto-order/apply-place-result"
import { finalizeAutoFulfillmentBatch } from "@/lib/auto-order/batch-finalize"
import { assertCircuitClosed, recordCircuitFailure } from "@/lib/auto-order/circuit-breaker"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"
import { dispatchPlaceSupplierOrder } from "@/lib/suppliers/place-order-resilient"
import { executeSupplierPayment } from "@/lib/auto-order/payment"
import { resolveFulfillmentChannel } from "@/lib/auto-order/resolve-channel"
import { logAutoOrder } from "@/lib/auto-order/telemetry"
import type { BatchRunResult, ShippingAddressPayload, SupplierGroup } from "@/lib/auto-order/types"
import { prisma } from "@/lib/prisma"
import { computeShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"
import {
  marketplaceWholesaleCentsForOption,
  variantsFromDb,
} from "@/lib/product-variants"

function parseShipping(raw: unknown): ShippingAddressPayload {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    name: typeof o.name === "string" ? o.name : undefined,
    line1: typeof o.line1 === "string" ? o.line1 : typeof o.line_1 === "string" ? o.line_1 : undefined,
    line2: typeof o.line2 === "string" ? o.line2 : undefined,
    city: typeof o.city === "string" ? o.city : undefined,
    state: typeof o.state === "string" ? o.state : undefined,
    postal_code:
      typeof o.postal_code === "string"
        ? o.postal_code
        : typeof o.postalCode === "string"
          ? o.postalCode
          : undefined,
    country: typeof o.country === "string" ? o.country : undefined,
    phone: typeof o.phone === "string" ? o.phone : undefined,
  }
}

async function loadPaidOrders(stripeSessionId: string) {
  return prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId }, { stripeSessionId: { startsWith: `${stripeSessionId}:line:` } }],
      status: "paid",
    },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  })
}

function unitCostCentsForOrder(
  product: { basePriceCents: number; variants: unknown; supplierSku: string | null },
  variantLabel: string | null,
  qty: number
) {
  const variants = variantsFromDb(product.variants)
  const optionName = variantLabel?.split("·")[0]?.trim() || null
  const unit = marketplaceWholesaleCentsForOption({
    productBasePriceCents: product.basePriceCents,
    variants,
    optionName,
  })
  return unit * qty
}

export async function enqueueAutoFulfillmentBatch(stripeSessionId: string): Promise<string | null> {
  const orders = await loadPaidOrders(stripeSessionId)
  if (orders.length === 0) return null

  const idempotencyKey = `batch:${stripeSessionId}`
  const existing = await prisma.autoFulfillmentBatch.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  })
  if (existing) return existing.id

  const batch = await prisma.autoFulfillmentBatch.create({
    data: {
      stripeSessionId,
      idempotencyKey,
      orderCount: orders.length,
      status: "PENDING",
      fulfillmentStatus: "PENDING",
    },
  })

  const paidAt = new Date()
  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: {
      autoFulfillmentBatchId: batch.id,
      paidAt,
      shipDeadlineAt: computeShipDeadlineAt(paidAt),
      fulfillmentStatus: "PENDING",
    },
  })

  logAutoOrder("batch_enqueued", { batchId: batch.id, orderCount: orders.length })
  return batch.id
}

export async function runAutoFulfillmentBatch(stripeSessionId: string): Promise<BatchRunResult> {
  const orders = await loadPaidOrders(stripeSessionId)
  if (orders.length === 0) {
    throw new Error("no_paid_orders_for_session")
  }

  const batch =
    (await prisma.autoFulfillmentBatch.findUnique({ where: { stripeSessionId } })) ??
    (await prisma.autoFulfillmentBatch.create({
      data: {
        stripeSessionId,
        idempotencyKey: `batch:${stripeSessionId}`,
        orderCount: orders.length,
      },
    }))

  await prisma.autoFulfillmentBatch.update({
    where: { id: batch.id },
    data: { status: "PROCESSING", startedAt: new Date(), fulfillmentStatus: "PROCESSING" },
  })

  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: { autoFulfillmentBatchId: batch.id, fulfillmentStatus: "PROCESSING" },
  })

  const shipping = parseShipping(orders[0]!.shippingAddress)
  const contactEmail = orders[0]!.customerEmail
  const groupMap = new Map<string, SupplierGroup>()

  for (const order of orders) {
    const resolved = await resolveFulfillmentChannel(order.product)
    if (!resolved) continue

    const unitCost = unitCostCentsForOrder(order.product, order.variantLabel, order.quantity)
    const sku = order.product.supplierSku ?? order.product.sourceSkuId ?? null
    const key = resolved.providerId

    const unitCostPerUnit = Math.round(unitCost / order.quantity)
    const unitRetailCents = Math.round(order.sellingPriceCents / order.quantity)
    const line = {
      orderId: order.id,
      productId: order.productId,
      productName: order.product.name,
      quantity: order.quantity,
      unitCostCents: unitCostPerUnit,
      unitPriceCents: unitRetailCents > 0 ? unitRetailCents : unitCostPerUnit,
      supplierSku: sku,
      variantLabel: order.variantLabel,
      channel: resolved.channel,
      providerId: resolved.providerId,
    }

    const g = groupMap.get(key)
    if (g) {
      g.lines.push(line)
      g.totalCostCents += unitCost
    } else {
      const provider = await prisma.fulfillmentProvider.findUnique({
        where: { id: resolved.providerId },
        select: { paymentMethod: true, channelType: true },
      })
      groupMap.set(key, {
        providerId: resolved.providerId,
        channel: provider?.channelType ?? resolved.channel,
        paymentMethod: provider?.paymentMethod ?? "NONE",
        lines: [line],
        totalCostCents: unitCost,
      })
    }
  }

  const jobResults: BatchRunResult["jobs"] = []
  let asyncPlacePending = 0
  const errors: Array<{ providerId: string; message: string }> = []

  for (const group of groupMap.values()) {
    const circuitKey = `provider:${group.providerId}`
    try {
      assertCircuitClosed(circuitKey)

      const provider = await prisma.fulfillmentProvider.findUnique({
        where: { id: group.providerId },
      })
      if (!provider || provider.status !== "ACTIVE") {
        throw new Error("provider_inactive")
      }

      const job = await prisma.supplierFulfillmentOrder.create({
        data: {
          batchId: batch.id,
          fulfillmentProviderId: group.providerId,
          totalCostCents: group.totalCostCents,
          paymentMethod: group.paymentMethod,
          status: "PROCESSING",
          lines: {
            create: group.lines.map((l) => ({
              orderId: l.orderId,
              productId: l.productId,
              quantity: l.quantity,
              unitCostCents: l.unitCostCents,
              supplierSku: l.supplierSku,
            })),
          },
        },
      })

      const payment = await executeSupplierPayment({
        method: group.paymentMethod,
        providerId: group.providerId,
        batchId: batch.id,
        group,
      })

      if (!payment.ok) {
        await prisma.supplierFulfillmentOrder.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: payment.error ?? "payment_failed",
            attempts: { increment: 1 },
          },
        })
        for (const l of group.lines) {
          await prisma.order.update({
            where: { id: l.orderId },
            data: {
              fulfillmentStatus: "MANUAL_REQUIRED",
              fulfillmentErrors: [{ payment: payment.error }] as Prisma.InputJsonValue,
            },
          })
        }
        errors.push({ providerId: group.providerId, message: payment.error ?? "payment_failed" })
        jobResults.push({ jobId: job.id, status: "FAILED", error: payment.error })
        recordCircuitFailure(circuitKey)
        continue
      }

      const placed = await dispatchPlaceSupplierOrder({
        supplierFulfillmentOrderId: job.id,
        batchId: batch.id,
        reference: `afb-${batch.id}-${job.id}`,
        shipping,
        contactEmail,
        group,
        paymentReference: payment.reference ?? null,
      })

      if (placed.deferred) {
        asyncPlacePending += 1
        jobResults.push({ jobId: job.id, status: "PROCESSING" })
        continue
      }

      const outcome = await applySupplierPlaceOrderResult({
        supplierFulfillmentOrderId: job.id,
        batchId: batch.id,
        providerId: group.providerId,
        group,
        placed,
        paymentReference: payment.reference ?? null,
      })

      if (!outcome.success && placed.errorMessage) {
        recordCircuitFailure(circuitKey)
        errors.push({ providerId: group.providerId, message: placed.errorMessage })
      }

      jobResults.push({
        jobId: job.id,
        status: placed.status,
        error: placed.errorMessage,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordCircuitFailure(circuitKey)
      errors.push({ providerId: group.providerId, message: msg })
      logAutoOrder("group_failed", { providerId: group.providerId, error: msg })
    }
  }

  if (asyncPlacePending > 0 && isAutoOrderQueueEnabled()) {
    await prisma.autoFulfillmentBatch.update({
      where: { id: batch.id },
      data: {
        status: "PROCESSING",
        fulfillmentStatus: "PROCESSING",
        supplierJobCount: jobResults.length,
        errors: errors.length ? (errors as Prisma.InputJsonValue) : undefined,
      },
    })
    logAutoOrder("batch_awaiting_place_workers", {
      batchId: batch.id,
      asyncPlacePending,
      jobs: jobResults.length,
    })
    return { batchId: batch.id, fulfillmentStatus: "PROCESSING", jobs: jobResults }
  }

  return finalizeAutoFulfillmentBatch(batch.id)
}
