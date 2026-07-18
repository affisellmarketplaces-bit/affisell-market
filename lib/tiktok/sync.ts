import "server-only"

import { Prisma } from ".prisma/client-mi"

import { decryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import { getOrderDetail, searchOrdersPage } from "@/lib/tiktok/client"
import { isTikTokOrderCancelled, mapTikTokOrderPayload } from "@/lib/tiktok/order-map"

export type TikTokSyncMode = "incremental" | "full"

export type SyncTikTokOrdersResult = {
  shopId: string
  mode: TikTokSyncMode
  scanned: number
  upserted: number
  skippedCancelled: number
  pages: number
  error?: string
}

/** Active / unpaid → completed — exclude cancelled (140). */
const ORDER_STATUS_SYNC = [100, 105, 111, 112, 114, 121, 122, 130]

function toDecimal(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Number(n.toFixed(4))
}

async function upsertMappedOrder(input: {
  shopId: string
  userId: string | null
  raw: Record<string, unknown>
}): Promise<"upserted" | "skipped_cancelled"> {
  const mapped = mapTikTokOrderPayload(input.raw)
  if (!mapped.orderId) return "skipped_cancelled"
  if (isTikTokOrderCancelled(mapped.status)) return "skipped_cancelled"

  const db = getRadarDb()
  await db.tikTokOrder.upsert({
    where: { shopId_orderId: { shopId: input.shopId, orderId: mapped.orderId } },
    create: {
      shopId: input.shopId,
      orderId: mapped.orderId,
      status: mapped.status,
      userId: input.userId,
      orderStatus: mapped.orderStatus,
      orderCreatedAt: mapped.orderCreatedAt,
      totalAmount: toDecimal(mapped.totalAmount),
      currency: mapped.currency,
      skuList: mapped.skuList as Prisma.InputJsonValue,
      shippingFee: toDecimal(mapped.shippingFee),
      productFee: toDecimal(mapped.productFee),
      platformFee: toDecimal(mapped.platformFee),
      customerInfo: (mapped.customerInfo ?? undefined) as Prisma.InputJsonValue | undefined,
      payload: mapped.raw as Prisma.InputJsonValue,
    },
    update: {
      status: mapped.status,
      orderStatus: mapped.orderStatus,
      orderCreatedAt: mapped.orderCreatedAt,
      totalAmount: toDecimal(mapped.totalAmount),
      currency: mapped.currency,
      skuList: mapped.skuList as Prisma.InputJsonValue,
      shippingFee: toDecimal(mapped.shippingFee),
      productFee: toDecimal(mapped.productFee),
      platformFee: toDecimal(mapped.platformFee),
      customerInfo: (mapped.customerInfo ?? undefined) as Prisma.InputJsonValue | undefined,
      payload: mapped.raw as Prisma.InputJsonValue,
      syncedAt: new Date(),
      userId: input.userId ?? undefined,
    },
  })
  return "upserted"
}

/**
 * Sync TikTok orders for one shop (idempotent upsert on shopId+orderId).
 * incremental: last 2h · full: last 30d (overridable via since/until).
 */
export async function syncTikTokOrders(
  shopId: string,
  opts?: {
    mode?: TikTokSyncMode
    since?: Date
    until?: Date
    maxPages?: number
    userId?: string | null
  }
): Promise<SyncTikTokOrdersResult> {
  const mode: TikTokSyncMode = opts?.mode ?? "incremental"
  const until = opts?.until ?? new Date()
  const since =
    opts?.since ??
    (mode === "full"
      ? new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(until.getTime() - 2 * 60 * 60 * 1000))
  const maxPages = opts?.maxPages ?? (mode === "full" ? 40 : 8)

  const db = getRadarDb()
  const conn = await db.shopConnection.findFirst({
    where: { connectorId: "tiktok_shop", shopId, status: "active" },
    orderBy: { updatedAt: "desc" },
  })
  if (!conn?.accessToken) {
    const result: SyncTikTokOrdersResult = {
      shopId,
      mode,
      scanned: 0,
      upserted: 0,
      skippedCancelled: 0,
      pages: 0,
      error: "no_active_connection",
    }
    console.warn("[tiktok/sync]", result)
    return result
  }

  const accessToken = decryptString(conn.accessToken)
  const userId = opts?.userId ?? conn.userId
  const createTimeGe = Math.floor(since.getTime() / 1000)
  const createTimeLt = Math.floor(until.getTime() / 1000)

  let pageToken: string | undefined
  let pages = 0
  let scanned = 0
  let upserted = 0
  let skippedCancelled = 0

  try {
    while (pages < maxPages) {
      const page = await searchOrdersPage(accessToken, shopId, {
        pageSize: 50,
        pageToken,
        createTimeGe,
        createTimeLt,
        orderStatusList: ORDER_STATUS_SYNC,
      })
      pages += 1

      for (const order of page.orders) {
        if (isTikTokOrderCancelled(order.status ?? null)) {
          skippedCancelled += 1
          continue
        }
        scanned += 1
        const detail =
          (await getOrderDetail(accessToken, shopId, order.orderId).catch(() => null)) ?? order
        const action = await upsertMappedOrder({
          shopId,
          userId,
          raw: detail.raw,
        })
        if (action === "upserted") upserted += 1
        else skippedCancelled += 1
      }

      if (!page.nextPageToken) break
      pageToken = page.nextPageToken
    }

    await db.tikTokWebhookLog.create({
      data: {
        type: `sync_${mode}`,
        shopId,
        status: "processed",
        externalId: `sync:${shopId}:${mode}:${createTimeGe}`,
        payload: {
          scanned,
          upserted,
          skippedCancelled,
          pages,
          since: since.toISOString(),
          until: until.toISOString(),
        } as Prisma.InputJsonValue,
      },
    })

    const result: SyncTikTokOrdersResult = {
      shopId,
      mode,
      scanned,
      upserted,
      skippedCancelled,
      pages,
    }
    console.log("[tiktok/sync]", result)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.tikTokWebhookLog
      .create({
        data: {
          type: `sync_${mode}`,
          shopId,
          status: "failed",
          error: message.slice(0, 500),
          payload: { scanned, upserted, pages } as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined)

    const result: SyncTikTokOrdersResult = {
      shopId,
      mode,
      scanned,
      upserted,
      skippedCancelled,
      pages,
      error: message,
    }
    console.error("[tiktok/sync]", result)
    return result
  }
}

export type SyncAllShopsResult = {
  mode: TikTokSyncMode
  shops: number
  results: SyncTikTokOrdersResult[]
}

/** Cron helper — loop all active TikTok Shop connections. */
export async function syncAllShops(opts?: {
  mode?: TikTokSyncMode
  since?: Date
  until?: Date
  take?: number
}): Promise<SyncAllShopsResult> {
  const mode: TikTokSyncMode = opts?.mode ?? "incremental"
  const db = getRadarDb()
  const connections = await db.shopConnection.findMany({
    where: { connectorId: "tiktok_shop", status: "active" },
    select: { shopId: true, userId: true },
    take: opts?.take ?? 100,
    orderBy: { updatedAt: "desc" },
  })

  const results: SyncTikTokOrdersResult[] = []
  for (const conn of connections) {
    const r = await syncTikTokOrders(conn.shopId, {
      mode,
      since: opts?.since,
      until: opts?.until,
      userId: conn.userId,
    })
    results.push(r)
  }

  console.log("[tiktok/syncAllShops]", {
    mode,
    shops: connections.length,
    upserted: results.reduce((a, r) => a + r.upserted, 0),
    errors: results.filter((r) => r.error).length,
  })

  return { mode, shops: connections.length, results }
}

/** Re-export mapper upsert for webhook processor. */
export async function upsertTikTokOrderFromRaw(input: {
  shopId: string
  userId: string | null
  raw: Record<string, unknown>
}): Promise<"upserted" | "skipped_cancelled"> {
  return upsertMappedOrder(input)
}
