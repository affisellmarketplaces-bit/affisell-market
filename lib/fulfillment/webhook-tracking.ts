import { fulfillmentOrchestrator } from "@/lib/fulfillment/orchestrator"
import { prisma } from "@/lib/prisma"

type ShopifyFulfillmentPayload = {
  order_id?: number | string
  tracking_number?: string | null
  tracking_company?: string | null
  tracking_url?: string | null
  status?: string
}

type WooShipmentPayload = {
  id?: number | string
  tracking_number?: string | null
  tracking_provider?: string | null
  tracking_link?: string | null
}

export async function applyShopifyFulfillmentWebhook(
  payload: ShopifyFulfillmentPayload
): Promise<{ ok: boolean; action: string; groupId?: string }> {
  const externalOrderId = payload.order_id != null ? String(payload.order_id) : null
  const trackingNumber = payload.tracking_number?.trim() ?? ""
  const carrier = payload.tracking_company?.trim() || "Shopify"

  if (!externalOrderId || !trackingNumber) {
    console.log("[fulfillment-webhook]", { provider: "shopify", action: "ignored_missing_fields" })
    return { ok: true, action: "ignored_missing_fields" }
  }

  const group = await prisma.fulfillmentGroup.findFirst({
    where: { externalOrderId },
    select: { id: true },
  })
  if (!group) {
    console.log("[fulfillment-webhook]", {
      provider: "shopify",
      action: "group_not_found",
      externalOrderId,
    })
    return { ok: true, action: "group_not_found" }
  }

  await fulfillmentOrchestrator.onTrackingUpdate(group.id, trackingNumber, carrier, {
    trackingUrl: payload.tracking_url,
    source: "supplier_fulfillment_webhook",
  })

  console.log("[fulfillment-webhook]", {
    provider: "shopify",
    action: "tracking_updated",
    groupId: group.id,
    externalOrderId,
  })
  return { ok: true, action: "tracking_updated", groupId: group.id }
}

export async function applyWooFulfillmentWebhook(
  payload: WooShipmentPayload,
  externalOrderId: string
): Promise<{ ok: boolean; action: string; groupId?: string }> {
  const trackingNumber = payload.tracking_number?.trim() ?? ""
  const carrier = payload.tracking_provider?.trim() || "WooCommerce"

  if (!trackingNumber) {
    console.log("[fulfillment-webhook]", { provider: "woo", action: "ignored_missing_tracking" })
    return { ok: true, action: "ignored_missing_tracking" }
  }

  const group = await prisma.fulfillmentGroup.findFirst({
    where: { externalOrderId },
    select: { id: true },
  })
  if (!group) {
    console.log("[fulfillment-webhook]", {
      provider: "woo",
      action: "group_not_found",
      externalOrderId,
    })
    return { ok: true, action: "group_not_found" }
  }

  await fulfillmentOrchestrator.onTrackingUpdate(group.id, trackingNumber, carrier, {
    trackingUrl: payload.tracking_link,
    source: "supplier_fulfillment_webhook",
  })

  console.log("[fulfillment-webhook]", {
    provider: "woo",
    action: "tracking_updated",
    groupId: group.id,
    externalOrderId,
  })
  return { ok: true, action: "tracking_updated", groupId: group.id }
}
