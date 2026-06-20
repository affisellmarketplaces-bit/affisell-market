import { applyAutoDsTrackingUpdate } from "@/lib/autods/apply-tracking-update"
import { fetchAutoDsOrderSnapshot, sleepMs } from "@/lib/autods/fetch-order"
import { isAutoDsConfigured } from "@/lib/autods/config"
import { logAutoDsFulfillmentEvent } from "@/lib/autods/fulfillment-log"
import { prisma } from "@/lib/prisma"

const OPEN_STATUSES = ["PENDING", "PROCESSING"] as const

export type AutoDsSyncRowResult = {
  orderId: string
  autodsOrderId: string
  updated: boolean
  skipped?: string
  error?: string
}

export async function syncOpenAutoDsOrders(limit = 100): Promise<AutoDsSyncRowResult[]> {
  if (!isAutoDsConfigured()) return []

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const rows = await prisma.order.findMany({
    where: {
      autodsOrderId: { not: null },
      autodsStatus: { in: [...OPEN_STATUSES] },
      createdAt: { gte: since },
    },
    select: { id: true, autodsOrderId: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  const results: AutoDsSyncRowResult[] = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    const autodsOrderId = row.autodsOrderId!.trim()

    if (i > 0) {
      await sleepMs(1000)
    }

    try {
      const snapshot = await fetchAutoDsOrderSnapshot(autodsOrderId)
      if (!snapshot) {
        results.push({
          orderId: row.id,
          autodsOrderId,
          updated: false,
          skipped: "fetch_empty",
        })
        continue
      }

      const applied = await applyAutoDsTrackingUpdate({
        payload: {
          autodsOrderId,
          status: snapshot.status,
          trackingNumber: snapshot.trackingNumber,
          trackingUrl: snapshot.trackingUrl,
          carrier: snapshot.carrier,
        },
        source: "cron",
        event: "sync_poll",
        response: snapshot.raw,
      })

      results.push({
        orderId: row.id,
        autodsOrderId,
        updated: Boolean(applied.updated),
        skipped: applied.skipped,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await logAutoDsFulfillmentEvent({
        orderId: row.id,
        event: "sync_poll_error",
        response: { error: message },
        source: "cron",
      })
      results.push({
        orderId: row.id,
        autodsOrderId,
        updated: false,
        error: message,
      })
    }
  }

  console.log("[autods-cron]", {
    polled: rows.length,
    updated: results.filter((r) => r.updated).length,
    errors: results.filter((r) => r.error).length,
  })

  return results
}

export async function resyncAutoDsOrderByAffisellId(orderId: string): Promise<AutoDsSyncRowResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, autodsOrderId: true },
  })

  if (!order?.autodsOrderId?.trim()) {
    return {
      orderId,
      autodsOrderId: "",
      updated: false,
      skipped: "no_autods_order",
    }
  }

  const autodsOrderId = order.autodsOrderId.trim()
  const snapshot = await fetchAutoDsOrderSnapshot(autodsOrderId)
  if (!snapshot) {
    return {
      orderId,
      autodsOrderId,
      updated: false,
      skipped: "fetch_empty",
    }
  }

  const applied = await applyAutoDsTrackingUpdate({
    payload: {
      autodsOrderId,
      status: snapshot.status,
      trackingNumber: snapshot.trackingNumber,
      trackingUrl: snapshot.trackingUrl,
      carrier: snapshot.carrier,
    },
    source: "admin_resync",
    event: "admin_resync",
    response: snapshot.raw,
  })

  return {
    orderId,
    autodsOrderId,
    updated: Boolean(applied.updated),
    skipped: applied.skipped,
  }
}
