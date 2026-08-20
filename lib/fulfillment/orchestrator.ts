import {
  FulfillmentGroupStatus,
  FulfillmentStatus,
  IntegrationProvider,
  IntegrationStatus,
  type Prisma,
} from "@prisma/client"

import type { ShippingAddressPayload } from "@/lib/auto-order/types"
import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"
import { notifyMarketplaceOrderShipped } from "@/lib/emails/notify-order-shipped"
import { parseShipping } from "@/lib/fulfillment/shipping-address"
import { createShopifyFulfillmentOrder } from "@/lib/fulfillment/providers/shopify-fulfill.provider"
import { createWooFulfillmentOrder } from "@/lib/fulfillment/providers/woo-fulfill.provider"
import {
  resolveBaseStripeSessionId,
  stripeSessionOrderWhere,
} from "@/lib/fulfillment/stripe-session-id"
import { recordOrderTrackingEvent } from "@/lib/order-tracking-event"
import { prisma } from "@/lib/prisma"
import { carrierTrackingUrl } from "@/lib/buyer-carrier-tracking"

const MAX_AUTO_BUY_ATTEMPTS = 3

type OrderWithProduct = Prisma.OrderGetPayload<{
  include: {
    product: {
      select: {
        id: true
        name: true
        externalId: true
        sourceSkuId: true
        sourceIntegrationId: true
        externalProvider: true
        importSource: true
      }
    }
  }
}>

function logFulfillment(metric: string, payload: Record<string, unknown>) {
  console.log("[fulfillment-orchestrator]", { metric, ...payload })
}

async function loadPaidSessionOrders(stripeSessionId: string) {
  const base = resolveBaseStripeSessionId(stripeSessionId)
  return prisma.order.findMany({
    where: {
      ...stripeSessionOrderWhere(base),
      status: "paid",
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          externalId: true,
          sourceSkuId: true,
          sourceIntegrationId: true,
          externalProvider: true,
          importSource: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })
}

async function resolveIntegrationForProduct(
  product: OrderWithProduct["product"],
  supplierId: string
) {
  if (product.sourceIntegrationId) {
    const row = await prisma.supplierIntegration.findFirst({
      where: {
        id: product.sourceIntegrationId,
        userId: supplierId,
        enabled: true,
        status: IntegrationStatus.CONNECTED,
      },
    })
    if (row) return row
  }

  const provider =
    product.externalProvider ??
    (product.importSource === "woocommerce-sync"
      ? IntegrationProvider.WOOCOMMERCE
      : product.importSource === "shopify-sync"
        ? IntegrationProvider.SHOPIFY
        : null)

  if (!provider) return null

  return prisma.supplierIntegration.findFirst({
    where: {
      userId: supplierId,
      provider,
      enabled: true,
      status: IntegrationStatus.CONNECTED,
    },
    orderBy: { updatedAt: "desc" },
  })
}

function buildShopifyLines(orders: OrderWithProduct[]) {
  return orders.map((order) => ({
    orderId: order.id,
    productExternalId: order.product.externalId,
    variantExternalId: order.product.sourceSkuId,
    quantity: order.quantity,
    title: order.product.name,
  }))
}

function buildWooLines(orders: OrderWithProduct[]) {
  return orders.map((order) => ({
    orderId: order.id,
    productExternalId: order.product.externalId,
    quantity: order.quantity,
    title: order.product.name,
  }))
}

async function recalcOrderFulfillmentStatus(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return

  const items = await prisma.fulfillmentItem.findMany({
    where: { orderId: { in: orderIds } },
    include: { fulfillmentGroup: { select: { status: true } } },
  })

  const byOrder = new Map<string, FulfillmentGroupStatus[]>()
  for (const item of items) {
    const list = byOrder.get(item.orderId) ?? []
    list.push(item.fulfillmentGroup.status)
    byOrder.set(item.orderId, list)
  }

  for (const orderId of orderIds) {
    const statuses = byOrder.get(orderId) ?? []
    let fulfillmentStatus: FulfillmentStatus = "PENDING"
    if (statuses.every((s) => s === "DELIVERED")) {
      fulfillmentStatus = "DELIVERED"
    } else if (statuses.every((s) => s === "SHIPPED" || s === "DELIVERED")) {
      fulfillmentStatus = "SHIPPED"
    } else if (statuses.some((s) => s === "SHIPPED" || s === "DELIVERED")) {
      fulfillmentStatus = "PARTIAL"
    } else if (statuses.some((s) => s === "AWAITING_SHIPMENT" || s === "AUTO_BUYING")) {
      fulfillmentStatus = "ORDERED"
    } else if (statuses.some((s) => s === "FAILED")) {
      fulfillmentStatus = "FAILED"
    } else if (statuses.some((s) => s === "PENDING")) {
      fulfillmentStatus = "MANUAL_REQUIRED"
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus },
    })
  }
}

export class FulfillmentOrchestrator {
  /** Idempotent split + queue auto-buy for all paid lines in checkout session. */
  async onOrderCreated(orderId: string): Promise<{ groupIds: string[] }> {
    const seed = await prisma.order.findUnique({
      where: { id: orderId },
      select: { stripeSessionId: true, status: true },
    })
    if (!seed || seed.status !== "paid") {
      logFulfillment("skip_not_paid", { orderId })
      return { groupIds: [] }
    }

    const baseSessionId = resolveBaseStripeSessionId(seed.stripeSessionId)
    const orders = await loadPaidSessionOrders(baseSessionId)
    if (orders.length === 0) return { groupIds: [] }

    const bySupplier = new Map<string, OrderWithProduct[]>()
    for (const order of orders) {
      const list = bySupplier.get(order.supplierId) ?? []
      list.push(order)
      bySupplier.set(order.supplierId, list)
    }

    const groupIds: string[] = []

    for (const [supplierId, supplierOrders] of bySupplier) {
      const integration = await resolveIntegrationForProduct(
        supplierOrders[0]!.product,
        supplierId
      )

      const group = await prisma.fulfillmentGroup.upsert({
        where: {
          stripeSessionId_supplierId: {
            stripeSessionId: baseSessionId,
            supplierId,
          },
        },
        create: {
          stripeSessionId: baseSessionId,
          supplierId,
          supplierIntegrationId: integration?.id ?? null,
          status: FulfillmentGroupStatus.PENDING,
        },
        update: {
          supplierIntegrationId: integration?.id ?? undefined,
        },
      })
      groupIds.push(group.id)

      for (const order of supplierOrders) {
        await prisma.fulfillmentItem.upsert({
          where: { orderId: order.id },
          create: {
            fulfillmentGroupId: group.id,
            orderId: order.id,
            quantity: order.quantity,
          },
          update: {
            quantity: order.quantity,
            fulfillmentGroupId: group.id,
          },
        })
      }

      logFulfillment("group_ready", {
        groupId: group.id,
        stripeSessionId: baseSessionId,
        supplierId,
        lineCount: supplierOrders.length,
        integrationId: integration?.id ?? null,
      })

      if (group.status === FulfillmentGroupStatus.PENDING || group.status === FulfillmentGroupStatus.FAILED) {
        void this.autoBuy(group.id).catch((e) => {
          console.error("[fulfillment-orchestrator] auto_buy_async_failed", {
            groupId: group.id,
            error: e instanceof Error ? e.message : String(e),
          })
        })
      }
    }

    return { groupIds }
  }

  async onCheckoutPaid(stripeSessionId: string): Promise<{ groupIds: string[] }> {
    const base = resolveBaseStripeSessionId(stripeSessionId)
    const first = await prisma.order.findFirst({
      where: stripeSessionOrderWhere(base),
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (!first) return { groupIds: [] }
    return this.onOrderCreated(first.id)
  }

  async autoBuy(groupId: string): Promise<{ ok: boolean; error?: string }> {
    const group = await prisma.fulfillmentGroup.findUnique({
      where: { id: groupId },
      include: {
        supplierIntegration: true,
        items: {
          include: {
            order: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    externalId: true,
                    sourceSkuId: true,
                    sourceIntegrationId: true,
                    externalProvider: true,
                    importSource: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!group) return { ok: false, error: "group_not_found" }
    if (
      group.status === FulfillmentGroupStatus.SHIPPED ||
      group.status === FulfillmentGroupStatus.DELIVERED ||
      group.status === FulfillmentGroupStatus.AUTO_BUYING
    ) {
      return { ok: true }
    }

    await prisma.fulfillmentGroup.update({
      where: { id: groupId },
      data: { status: FulfillmentGroupStatus.AUTO_BUYING, error: null },
    })

    const orders = group.items.map((i) => i.order)
    if (orders.length === 0) {
      await this.markFailed(groupId, "NO_ORDER_LINES")
      return { ok: false, error: "NO_ORDER_LINES" }
    }

    const shippingAddress = parseShipping(orders[0]!.shippingAddress)
    const customerEmail = orders[0]!.customerEmail
    const integration =
      group.supplierIntegration ??
      (await resolveIntegrationForProduct(orders[0]!.product, group.supplierId))

    if (!integration) {
      await prisma.fulfillmentGroup.update({
        where: { id: groupId },
        data: {
          status: FulfillmentGroupStatus.AWAITING_SHIPMENT,
          manualNote: "Manual fulfillment required — no connected integration",
          supplierIntegrationId: null,
        },
      })

      for (const order of orders) {
        void dispatchMerchantOrderAlerts(order.id)
      }

      await recalcOrderFulfillmentStatus(orders.map((o) => o.id))
      logFulfillment("manual_required", { groupId, supplierId: group.supplierId })
      return { ok: true }
    }

    const provider = integration.provider
    let result:
      | { ok: true; externalOrderId: string; raw: unknown; payload: unknown }
      | { ok: false; error: string; raw?: unknown; payload: unknown }

    if (provider === IntegrationProvider.SHOPIFY) {
      const payload = {
        customerEmail,
        shippingAddress,
        lines: buildShopifyLines(orders),
      }
      const shopify = await createShopifyFulfillmentOrder({
        integration,
        ...payload,
      })
      result = shopify.ok
        ? { ok: true, externalOrderId: shopify.externalOrderId, raw: shopify.raw, payload }
        : { ok: false, error: shopify.error, raw: shopify.raw, payload }
    } else if (provider === IntegrationProvider.WOOCOMMERCE) {
      const payload = {
        customerEmail,
        shippingAddress,
        lines: buildWooLines(orders),
      }
      const woo = await createWooFulfillmentOrder({
        integration: {
          provider: integration.provider,
          shopDomain: integration.shopDomain,
          accessTokenEncrypted: integration.accessTokenEncrypted,
        },
        ...payload,
      })
      result = woo.ok
        ? { ok: true, externalOrderId: woo.externalOrderId, raw: woo.raw, payload }
        : { ok: false, error: woo.error, raw: woo.raw, payload }
    } else {
      await prisma.fulfillmentGroup.update({
        where: { id: groupId },
        data: {
          status: FulfillmentGroupStatus.AWAITING_SHIPMENT,
          manualNote: `Manual fulfillment — unsupported provider ${provider ?? "unknown"}`,
        },
      })
      for (const order of orders) {
        void dispatchMerchantOrderAlerts(order.id)
      }
      return { ok: true }
    }

    if (!result.ok) {
      await this.markFailed(groupId, result.error, {
        autoBuyPayload: result.payload,
        autoBuyResponse: result.raw ?? null,
      })
      return { ok: false, error: result.error }
    }

    await prisma.fulfillmentGroup.update({
      where: { id: groupId },
      data: {
        status: FulfillmentGroupStatus.AWAITING_SHIPMENT,
        externalOrderId: result.externalOrderId,
        autoBuyPayload: result.payload as Prisma.InputJsonValue,
        autoBuyResponse: result.raw as Prisma.InputJsonValue,
        error: null,
        supplierIntegrationId: integration.id,
      },
    })

    await prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: {
        supplierOrderId: result.externalOrderId,
        status: "preparing",
        supplierPreparingAt: new Date(),
        fulfillmentStatus: "ORDERED",
      },
    })

    await recalcOrderFulfillmentStatus(orders.map((o) => o.id))
    logFulfillment("auto_buy_success", {
      groupId,
      externalOrderId: result.externalOrderId,
      provider,
    })
    return { ok: true }
  }

  async retryAutoBuy(groupId: string): Promise<{ ok: boolean; error?: string }> {
    const group = await prisma.fulfillmentGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    })
    if (!group) return { ok: false, error: "group_not_found" }
    if (group.status !== FulfillmentGroupStatus.FAILED) {
      return { ok: false, error: "not_failed" }
    }

    await prisma.fulfillmentGroup.update({
      where: { id: groupId },
      data: { status: FulfillmentGroupStatus.PENDING, error: null },
    })
    return this.autoBuy(groupId)
  }

  private async markFailed(
    groupId: string,
    error: string,
    extra?: { autoBuyPayload?: unknown; autoBuyResponse?: unknown }
  ) {
    await prisma.fulfillmentGroup.update({
      where: { id: groupId },
      data: {
        status: FulfillmentGroupStatus.FAILED,
        error: error.slice(0, 2000),
        autoBuyPayload: extra?.autoBuyPayload as Prisma.InputJsonValue | undefined,
        autoBuyResponse: extra?.autoBuyResponse as Prisma.InputJsonValue | undefined,
      },
    })
    logFulfillment("auto_buy_failed", { groupId, error })
  }

  async onTrackingUpdate(
    groupId: string,
    trackingNumber: string,
    carrier: string,
    options?: { trackingUrl?: string | null; source?: "supplier_mark_shipped" | "supplier_fulfillment_webhook" }
  ): Promise<{ ok: boolean; error?: string }> {
    const normalized = trackingNumber.trim()
    const carrierLabel = carrier.trim()
    if (!normalized || !carrierLabel) {
      return { ok: false, error: "missing_tracking" }
    }

    const group = await prisma.fulfillmentGroup.findUnique({
      where: { id: groupId },
      include: { items: { select: { orderId: true } } },
    })
    if (!group) return { ok: false, error: "group_not_found" }

    const trackingUrl =
      options?.trackingUrl?.trim() ||
      carrierTrackingUrl(carrierLabel, normalized) ||
      null

    const orderIds = group.items.map((i) => i.orderId)

    await prisma.$transaction(async (tx) => {
      await tx.fulfillmentGroup.update({
        where: { id: groupId },
        data: {
          status: FulfillmentGroupStatus.SHIPPED,
          trackingNumber: normalized,
          trackingCarrier: carrierLabel,
          trackingUrl,
        },
      })

      for (const orderId of orderIds) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "shipped",
            trackingNumber: normalized,
            trackingCarrier: carrierLabel,
            shippedAt: new Date(),
            fulfillmentStatus: "SHIPPED",
          },
        })

        await recordOrderTrackingEvent(
          {
            orderId,
            eventType: "TRACKING_REGISTERED",
            source: options?.source ?? "supplier_fulfillment_webhook",
            trackingCarrier: carrierLabel,
            trackingNumber: normalized,
            fulfillmentStatus: "SHIPPED",
          },
          tx
        )
      }
    })

    await recalcOrderFulfillmentStatus(orderIds)

    const sessionGroups = await prisma.fulfillmentGroup.findMany({
      where: { stripeSessionId: group.stripeSessionId },
      select: { status: true },
    })
    const shippedCount = sessionGroups.filter(
      (g) => g.status === "SHIPPED" || g.status === "DELIVERED"
    ).length
    const totalCount = sessionGroups.length

    for (const orderId of orderIds) {
      void notifyMarketplaceOrderShipped(orderId, {
        trackingNumber: normalized,
        carrier: carrierLabel,
        trackingUrl,
      })
    }

    logFulfillment("tracking_updated", {
      groupId,
      trackingNumber: normalized,
      carrier: carrierLabel,
      part: `${shippedCount}/${totalCount}`,
    })
    return { ok: true }
  }

  async getUnifiedTracking(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        stripeSessionId: true,
        customerEmail: true,
        buyerUserId: true,
        supplier: { select: { store: { select: { partnerListingCode: true } } } },
      },
    })
    if (!order) return null

    const baseSessionId = resolveBaseStripeSessionId(order.stripeSessionId)
    const groups = await prisma.fulfillmentGroup.findMany({
      where: { stripeSessionId: baseSessionId },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                product: { select: { name: true } },
                quantity: true,
              },
            },
          },
        },
        supplierIntegration: { select: { provider: true, shopDomain: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return {
      orderId: order.id,
      stripeSessionId: baseSessionId,
      parcelCount: groups.length,
      groups: groups.map((g, index) => ({
        id: g.id,
        index: index + 1,
        status: g.status,
        supplierId: g.supplierId,
        provider: g.supplierIntegration?.provider ?? null,
        externalOrderId: g.externalOrderId,
        trackingNumber: g.trackingNumber,
        trackingCarrier: g.trackingCarrier,
        trackingUrl: g.trackingUrl,
        manualNote: g.manualNote,
        error: g.error,
        items: g.items.map((item) => ({
          orderId: item.orderId,
          quantity: item.quantity,
          productName: item.order.product.name,
        })),
      })),
    }
  }
}

export const fulfillmentOrchestrator = new FulfillmentOrchestrator()

/** Background hook after checkout — non-blocking. */
export async function triggerFulfillmentOrchestratorForSession(
  stripeSessionId: string
): Promise<void> {
  try {
    const { groupIds } = await fulfillmentOrchestrator.onCheckoutPaid(stripeSessionId)
    logFulfillment("checkout_triggered", { stripeSessionId, groupCount: groupIds.length })
  } catch (e) {
    console.error("[fulfillment-orchestrator] checkout_trigger_failed", {
      stripeSessionId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export { MAX_AUTO_BUY_ATTEMPTS }
