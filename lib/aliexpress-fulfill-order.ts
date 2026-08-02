import "server-only"

import { createAliExpressDsOrder } from "@/lib/aliexpress-ds-create-order"
import { summarizeAddressForLog, type AffisellShippingAddressInput } from "@/lib/aliexpress-mapping"
import { parseShipping } from "@/lib/fulfillment/shipping-address"
import { resolveSupplierSkuForOrder } from "@/lib/fulfillment/resolve-supplier-sku"
import { prisma } from "@/lib/prisma"

export type FulfillAffisellOrderResult =
  | {
      ok: true
      orderId: string
      aliexpressOrderId: string
      trackingPreview: string | null
      status: "fulfilling"
      alreadyFulfilled?: boolean
    }
  | {
      ok: false
      error: string
      orderId?: string
    }

function shippingFromOrderJson(raw: unknown): AffisellShippingAddressInput {
  const parsed = parseShipping(raw)
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    name: parsed.name,
    phone: parsed.phone ?? (typeof o.phone === "string" ? o.phone : undefined),
    email: typeof o.email === "string" ? o.email : undefined,
    line1: parsed.line1,
    line2: parsed.line2,
    address1: parsed.line1,
    address2: parsed.line2,
    city: parsed.city,
    state: parsed.state,
    postal_code: parsed.postal_code,
    zip: parsed.postal_code,
    country: parsed.country,
    countryCode: parsed.country,
  }
}

/**
 * Idempotent: paid Affisell order → AliExpress DS create → supplierOrderId + status fulfilling.
 */
export async function fulfillAffisellOrderWithAliExpress(
  orderId: string
): Promise<FulfillAffisellOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
      autoBuyLog: { select: { id: true, aeOrderId: true, status: true } },
    },
  })

  if (!order) return { ok: false, error: "order_not_found", orderId }

  if (order.supplierOrderId) {
    console.log("[aliexpress-fulfill]", {
      result: "idempotent",
      orderId,
      supplierOrderIdTail: order.supplierOrderId.slice(-6),
    })
    return {
      ok: true,
      orderId,
      aliexpressOrderId: order.supplierOrderId,
      trackingPreview: null,
      status: "fulfilling",
      alreadyFulfilled: true,
    }
  }

  if (order.autoBuyLog?.status === "BUYING") {
    return { ok: false, error: "fulfillment_in_progress", orderId }
  }

  if (order.autoBuyLog?.aeOrderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        supplierOrderId: order.autoBuyLog.aeOrderId,
        status: "fulfilling",
        fulfillmentStatus: "ORDERED",
        supplierPreparingAt: order.supplierPreparingAt ?? new Date(),
      },
    })
    return {
      ok: true,
      orderId,
      aliexpressOrderId: order.autoBuyLog.aeOrderId,
      trackingPreview: null,
      status: "fulfilling",
      alreadyFulfilled: true,
    }
  }

  if (order.status !== "paid" && order.status !== "fulfilling" && order.status !== "preparing") {
    return { ok: false, error: "not_paid", orderId }
  }

  const link = order.product.supplierLink
  if (!link?.isActive || !link.aeProductId) {
    return { ok: false, error: "no_supplier_link", orderId }
  }

  const resolved = resolveSupplierSkuForOrder(
    {
      aeSkuId: link.aeSkuId,
      aePriceCents: link.aePriceCents,
      aeShippingCents: link.aeShippingCents,
    },
    link.variantMappings,
    { variantLabel: order.variantLabel, quantity: order.quantity },
    order.product.productVariants
  )

  const skuId = (resolved.aeSkuId ?? link.aeSkuId ?? "").trim()
  if (!skuId) {
    return { ok: false, error: "sku_unresolved", orderId }
  }

  const shippingAddress = shippingFromOrderJson(order.shippingAddress)
  console.log("[aliexpress-fulfill]", {
    result: "placing",
    orderId,
    productId: link.aeProductId,
    ...summarizeAddressForLog(shippingAddress),
  })

  const placed = await createAliExpressDsOrder({
    supplierProductId: link.aeProductId,
    skuId,
    quantity: order.quantity,
    shippingAddress,
    customerNote: `Affisell order ${order.id}`,
  })

  if (!placed.ok) {
    console.log("[aliexpress-fulfill]", { result: "failed", orderId, error: placed.error })
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentErrors: {
          aliexpress: placed.error,
          at: new Date().toISOString(),
          methods: placed.methodAttempts,
        },
      },
    })
    return { ok: false, error: placed.error, orderId }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        supplierOrderId: placed.aliexpressOrderId,
        status: "fulfilling",
        fulfillmentStatus: "ORDERED",
        supplierPreparingAt: new Date(),
        fulfilledAt: new Date(),
      },
    })

    await tx.fulfillmentLog.upsert({
      where: { orderId },
      create: {
        orderId,
        orderItemId: orderId,
        status: "BOUGHT",
        aeOrderId: placed.aliexpressOrderId,
        aeTracking: placed.trackingPreview,
        attempts: 1,
      },
      update: {
        status: "BOUGHT",
        aeOrderId: placed.aliexpressOrderId,
        aeTracking: placed.trackingPreview,
        errorMsg: null,
      },
    })
  })

  console.log("[aliexpress-fulfill]", {
    result: "ok",
    orderId,
    aliexpressOrderIdTail: placed.aliexpressOrderId.slice(-6),
    status: "fulfilling",
  })

  return {
    ok: true,
    orderId,
    aliexpressOrderId: placed.aliexpressOrderId,
    trackingPreview: placed.trackingPreview,
    status: "fulfilling",
  }
}
