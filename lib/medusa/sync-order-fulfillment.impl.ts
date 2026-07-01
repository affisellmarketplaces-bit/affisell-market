import { z } from "zod"

import { carrierTrackingUrl } from "@/lib/buyer-carrier-tracking"
import { hasMedusaAdminToken, medusaAdminFetch } from "@/lib/medusa-admin.impl"

const MedusaOrderItemSchema = z.object({
  id: z.string(),
  quantity: z.number().optional(),
  detail: z
    .object({
      fulfilled_quantity: z.number().optional(),
      shipped_quantity: z.number().optional(),
    })
    .optional(),
})

const MedusaFulfillmentSchema = z.object({
  id: z.string(),
  shipped_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  labels: z
    .array(
      z.object({
        tracking_number: z.string().optional(),
      })
    )
    .optional(),
})

const MedusaOrderSnapshotSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  fulfillment_status: z.string().optional(),
  items: z.array(MedusaOrderItemSchema).optional(),
  fulfillments: z.array(MedusaFulfillmentSchema).optional(),
})

export type MedusaOrderSnapshot = z.infer<typeof MedusaOrderSnapshotSchema>

export type MedusaFulfillmentItemInput = {
  id: string
  quantity: number
}

export type SyncAffisellShipmentToMedusaInput = {
  affisellOrderId: string
  medusaOrderId: string
  trackingNumber: string
  trackingCarrier?: string | null
}

let cachedStockLocationId: string | null | undefined

export function pendingMedusaFulfillmentItems(
  items: MedusaOrderSnapshot["items"]
): MedusaFulfillmentItemInput[] {
  if (!items?.length) return []

  return items
    .map((item) => {
      const total = Math.max(1, item.quantity ?? 1)
      const shipped = Math.max(0, item.detail?.shipped_quantity ?? 0)
      const fulfilled = Math.max(shipped, item.detail?.fulfilled_quantity ?? 0)
      const remaining = total - fulfilled
      if (remaining <= 0) return null
      return { id: item.id, quantity: remaining }
    })
    .filter((row): row is MedusaFulfillmentItemInput => row != null)
}

export function isMedusaOrderFullyShipped(order: MedusaOrderSnapshot): boolean {
  if (order.fulfillment_status === "shipped" || order.fulfillment_status === "fulfilled") {
    return true
  }

  const fulfillments = order.fulfillments ?? []
  if (fulfillments.length === 0) return false

  return fulfillments.every(
    (f) => Boolean(f.shipped_at?.trim()) || Boolean(f.delivered_at?.trim())
  )
}

export function medusaShipmentAlreadyRecorded(
  order: MedusaOrderSnapshot,
  trackingNumber: string
): boolean {
  const normalized = trackingNumber.trim()
  if (!normalized) return false

  return (order.fulfillments ?? []).some((f) =>
    (f.labels ?? []).some((label) => label.tracking_number?.trim() === normalized)
  )
}

export function buildMedusaShipmentLabels(
  trackingNumber: string,
  trackingCarrier?: string | null
): Array<{ tracking_number: string; tracking_url: string; label_url: string }> {
  const number = trackingNumber.trim()
  const trackingUrl =
    carrierTrackingUrl(trackingCarrier, number) ??
    `https://affisell.com/track-order?tracking=${encodeURIComponent(number)}`

  return [
    {
      tracking_number: number,
      tracking_url: trackingUrl,
      label_url: trackingUrl,
    },
  ]
}

async function resolveMedusaStockLocationId(): Promise<string | null> {
  const fromEnv = process.env.MEDUSA_STOCK_LOCATION_ID?.trim()
  if (fromEnv) return fromEnv

  if (cachedStockLocationId !== undefined) {
    return cachedStockLocationId
  }

  try {
    const json = await medusaAdminFetch<{ stock_locations?: Array<{ id?: string }> }>(
      "/admin/stock-locations?limit=1"
    )
    cachedStockLocationId = json.stock_locations?.[0]?.id?.trim() ?? null
  } catch (err) {
    console.warn("[medusa-fulfillment] stock location lookup failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    cachedStockLocationId = null
  }

  return cachedStockLocationId
}

async function fetchMedusaOrderSnapshot(medusaOrderId: string): Promise<MedusaOrderSnapshot | null> {
  const json = await medusaAdminFetch<{ order?: unknown }>(
    `/admin/orders/${medusaOrderId}?fields=id,status,fulfillment_status,items,*items,*fulfillments`
  )
  const parsed = MedusaOrderSnapshotSchema.safeParse(json.order)
  if (!parsed.success) {
    console.error("[medusa-fulfillment] invalid order payload", {
      medusaOrderId,
      issues: parsed.error.issues,
    })
    return null
  }
  return parsed.data
}

function pickOpenFulfillment(order: MedusaOrderSnapshot): { id: string } | null {
  const open = (order.fulfillments ?? []).find(
    (f) => !f.shipped_at?.trim() && !f.delivered_at?.trim()
  )
  return open ? { id: open.id } : null
}

/**
 * Mirror Affisell supplier shipment to Medusa Admin (fulfillment + shipment).
 * Idempotent — safe to replay webhook/heal. Never throws.
 */
export async function syncAffisellShipmentToMedusaIfNeeded(
  input: SyncAffisellShipmentToMedusaInput
): Promise<{ synced: boolean; reason?: string }> {
  const medusaOrderId = input.medusaOrderId.trim()
  const trackingNumber = input.trackingNumber.trim()

  if (!medusaOrderId || !trackingNumber) {
    return { synced: false, reason: "missing_ids" }
  }

  if (!hasMedusaAdminToken()) {
    console.warn("[medusa-fulfillment] MEDUSA_ADMIN_TOKEN missing, skip", {
      affisellOrderId: input.affisellOrderId,
    })
    return { synced: false, reason: "no_token" }
  }

  try {
    let order = await fetchMedusaOrderSnapshot(medusaOrderId)
    if (!order) {
      return { synced: false, reason: "order_not_found" }
    }

    if (medusaShipmentAlreadyRecorded(order, trackingNumber)) {
      console.log("[medusa-fulfillment] tracking already synced", {
        affisellOrderId: input.affisellOrderId,
        medusaOrderId,
        trackingNumber,
      })
      return { synced: false, reason: "already_synced" }
    }

    if (isMedusaOrderFullyShipped(order)) {
      console.log("[medusa-fulfillment] order already shipped in Medusa", {
        affisellOrderId: input.affisellOrderId,
        medusaOrderId,
      })
      return { synced: false, reason: "already_shipped" }
    }

    let fulfillmentId = pickOpenFulfillment(order)?.id
    const pendingItems = pendingMedusaFulfillmentItems(order.items)

    if (!fulfillmentId && pendingItems.length > 0) {
      const locationId = await resolveMedusaStockLocationId()
      const fulfillmentBody: {
        items: MedusaFulfillmentItemInput[]
        location_id?: string
        no_notification: boolean
        metadata: Record<string, unknown>
      } = {
        items: pendingItems,
        no_notification: true,
        metadata: {
          affisell_order_id: input.affisellOrderId,
          source: "affisell_supplier_shipped",
        },
      }
      if (locationId) {
        fulfillmentBody.location_id = locationId
      }

      const created = await medusaAdminFetch<{ order?: unknown }>(
        `/admin/orders/${medusaOrderId}/fulfillments`,
        {
          method: "POST",
          body: JSON.stringify(fulfillmentBody),
        }
      )
      const parsed = MedusaOrderSnapshotSchema.safeParse(created.order)
      order = parsed.success ? parsed.data : await fetchMedusaOrderSnapshot(medusaOrderId)
      if (!order) {
        return { synced: false, reason: "fulfillment_refresh_failed" }
      }
      fulfillmentId = pickOpenFulfillment(order)?.id ?? order.fulfillments?.[0]?.id
    }

    if (!fulfillmentId) {
      fulfillmentId = order.fulfillments?.[0]?.id
    }
    if (!fulfillmentId) {
      console.warn("[medusa-fulfillment] no fulfillment to ship", {
        affisellOrderId: input.affisellOrderId,
        medusaOrderId,
      })
      return { synced: false, reason: "no_fulfillment" }
    }

    const shipmentItems =
      pendingItems.length > 0
        ? pendingItems
        : (order.items ?? []).map((item) => ({
            id: item.id,
            quantity: Math.max(1, item.quantity ?? 1),
          }))

    await medusaAdminFetch(`/admin/orders/${medusaOrderId}/fulfillments/${fulfillmentId}/shipments`, {
      method: "POST",
      body: JSON.stringify({
        items: shipmentItems,
        labels: buildMedusaShipmentLabels(trackingNumber, input.trackingCarrier),
        no_notification: true,
        metadata: {
          affisell_order_id: input.affisellOrderId,
          affisell_carrier: input.trackingCarrier?.trim() || undefined,
        },
      }),
    })

    console.log("[medusa-fulfillment] shipment synced", {
      affisellOrderId: input.affisellOrderId,
      medusaOrderId,
      fulfillmentId,
      trackingNumber,
    })
    return { synced: true }
  } catch (err) {
    console.error("[medusa-fulfillment] sync failed", {
      affisellOrderId: input.affisellOrderId,
      medusaOrderId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { synced: false, reason: "error" }
  }
}
