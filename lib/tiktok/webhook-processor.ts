import "server-only"

import { decryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import { getOrderDetail, getOrders } from "@/lib/tiktok/client"
import { upsertTikTokOrderFromRaw } from "@/lib/tiktok/sync"

export type TikTokWebhookPayload = {
  type?: string | number
  shop_id?: string | number
  shopId?: string | number
  data?: Record<string, unknown>
  timestamp?: number | string
}

function asShopId(payload: TikTokWebhookPayload): string | null {
  const raw = payload.shop_id ?? payload.shopId
  if (raw == null) return null
  return String(raw).trim() || null
}

function asType(payload: TikTokWebhookPayload): string {
  if (payload.type == null) return "unknown"
  return String(payload.type)
}

/**
 * Background processor — must not block webhook 200 response.
 * Types 1–4: orders · 5: product · 6: auth revoke
 */
export async function processTikTokWebhookEvent(input: {
  externalId: string
  payload: TikTokWebhookPayload
  logId?: string
}): Promise<void> {
  const db = getRadarDb()
  const shopId = asShopId(input.payload)
  const type = asType(input.payload)

  try {
    if (type === "6" || type === "auth_revoke" || type === "seller_deauthorization") {
      if (shopId) {
        await db.shopConnection.updateMany({
          where: { connectorId: "tiktok_shop", shopId },
          data: { status: "disconnected" },
        })
        console.log("[tiktok/webhook]", { type, shopId, result: "disconnected" })
      }
    } else if (["1", "2", "3", "4"].includes(type) || type.startsWith("order")) {
      if (!shopId) throw new Error("order webhook missing shop_id")

      const conn = await db.shopConnection.findFirst({
        where: { connectorId: "tiktok_shop", shopId, status: "active" },
        orderBy: { updatedAt: "desc" },
      })
      if (!conn?.accessToken) {
        console.warn("[tiktok/webhook]", { type, shopId, result: "no_connection" })
      } else {
        const accessToken = decryptString(conn.accessToken)
        const data = input.payload.data ?? {}
        const orderId = String(data.order_id ?? data.orderId ?? data.id ?? "").trim()

        let orderPayload: Record<string, unknown> = data

        if (orderId) {
          const detail = await getOrderDetail(accessToken, shopId, orderId).catch(() => null)
          if (detail) orderPayload = detail.raw
        } else {
          const recent = await getOrders(accessToken, shopId, { pageSize: 5 }).catch(() => [])
          if (recent[0]) orderPayload = recent[0].raw
        }

        const oid = orderId || String(orderPayload.order_id ?? "").trim()
        if (oid) {
          await upsertTikTokOrderFromRaw({
            shopId,
            userId: conn.userId,
            raw: { ...orderPayload, order_id: oid },
          })
        }
      }
    } else if (type === "5" || type.includes("product")) {
      console.log("[tiktok/webhook]", { type, shopId, result: "product_cache_invalidate" })
      if (shopId) {
        await db.shopConnection.updateMany({
          where: { connectorId: "tiktok_shop", shopId },
          data: { updatedAt: new Date() },
        })
      }
    }

    if (input.logId) {
      await db.tikTokWebhookLog.update({
        where: { id: input.logId },
        data: { status: "processed" },
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[tiktok/webhook]", { type, shopId, result: "process_failed", message })
    if (input.logId) {
      await db.tikTokWebhookLog.update({
        where: { id: input.logId },
        data: { status: "failed", error: message.slice(0, 500) },
      })
    }
  }
}
