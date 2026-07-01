import webpush from "web-push"

import { prisma } from "@/lib/prisma"
import { readWebPushVapidConfig } from "@/lib/web-push-config"

export type PriceDropPushPayload = {
  userId: string
  productName: string
  listingUrl: string
  currentPriceLabel: string
  dropPercent: number
}

function configureWebPush(): boolean {
  const config = readWebPushVapidConfig()
  if (!config) return false
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  return true
}

export async function sendPriceDropPushToUser(payload: PriceDropPushPayload): Promise<number> {
  if (!configureWebPush()) return 0

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: payload.userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  if (subs.length === 0) return 0

  const title =
    payload.dropPercent > 0
      ? `Baisse de prix · ${payload.productName}`
      : `Prix cible atteint · ${payload.productName}`
  const body =
    payload.dropPercent > 0
      ? `${payload.currentPriceLabel} (-${payload.dropPercent}%)`
      : `Maintenant ${payload.currentPriceLabel}`

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title,
          body,
          url: payload.listingUrl,
        })
      )
      sent++
    } catch (e) {
      const status = typeof e === "object" && e && "statusCode" in e ? Number(e.statusCode) : 0
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined)
      }
      console.log("[web-push]", {
        userId: payload.userId,
        endpoint: sub.endpoint.slice(0, 48),
        result: "failed",
        status,
      })
    }
  }

  if (sent > 0) {
    console.log("[web-push]", { userId: payload.userId, result: "sent", count: sent })
  }
  return sent
}
