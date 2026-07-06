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

export type OrderStatusPushPayload = {
  userId: string
  orderId: string
  productName: string
  kind: "shipped" | "delivered"
  detail?: string | null
  /** When set, delivered push deep-links to the review form. */
  reviewUrl?: string | null
}

export type ReviewNudgePushPayload = {
  userId: string
  orderId: string
  productName: string
  reviewUrl: string
}

export type WholesaleChangePushPayload = {
  userId: string
  listingId: string
  productName: string
  atLoss: boolean
  variantCount: number
}

export type AbandonedCartPushPayload = {
  userId: string
  productName: string
  recoveryUrl: string
  priceLabel?: string
}

function configureWebPush(): boolean {
  const config = readWebPushVapidConfig()
  if (!config) return false
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  return true
}

async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string; tag: string }
): Promise<number> {
  if (!configureWebPush()) return 0

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  if (subs.length === 0) return 0

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message
      )
      sent++
    } catch (e) {
      const status = typeof e === "object" && e && "statusCode" in e ? Number(e.statusCode) : 0
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined)
      }
      console.log("[web-push]", {
        userId,
        tag: payload.tag,
        endpoint: sub.endpoint.slice(0, 48),
        result: "failed",
        status,
      })
    }
  }

  if (sent > 0) {
    console.log("[web-push]", { userId, tag: payload.tag, result: "sent", count: sent })
  }
  return sent
}

export async function sendPriceDropPushToUser(payload: PriceDropPushPayload): Promise<number> {
  const title =
    payload.dropPercent > 0
      ? `Baisse de prix · ${payload.productName}`
      : `Prix cible atteint · ${payload.productName}`
  const body =
    payload.dropPercent > 0
      ? `${payload.currentPriceLabel} (-${payload.dropPercent}%)`
      : `Maintenant ${payload.currentPriceLabel}`

  return sendPushToUser(payload.userId, {
    title,
    body,
    url: payload.listingUrl,
    tag: "affisell-price-alert",
  })
}

export async function sendOrderStatusPushToUser(payload: OrderStatusPushPayload): Promise<number> {
  const ordersUrl = `/marketplace/account/orders?orderId=${encodeURIComponent(payload.orderId)}`
  if (payload.kind === "shipped") {
    return sendPushToUser(payload.userId, {
      title: `Commande expédiée · ${payload.productName}`,
      body: payload.detail?.trim() || "Votre colis est en route.",
      url: ordersUrl,
      tag: `affisell-order-shipped-${payload.orderId}`,
    })
  }
  const deliveredUrl = payload.reviewUrl?.trim() || ordersUrl
  return sendPushToUser(payload.userId, {
    title: `Commande livrée · ${payload.productName}`,
    body: payload.detail?.trim() || "Merci pour votre achat — laissez un avis si vous le souhaitez.",
    url: deliveredUrl,
    tag: `affisell-order-delivered-${payload.orderId}`,
  })
}

export async function sendReviewNudgePushToUser(payload: ReviewNudgePushPayload): Promise<number> {
  return sendPushToUser(payload.userId, {
    title: `Votre avis compte · ${payload.productName}`,
    body: "30 secondes pour noter votre achat — merci !",
    url: payload.reviewUrl,
    tag: `affisell-review-nudge-${payload.orderId}`,
  })
}

export function wholesaleChangePushUrl(listingId: string): string {
  return `/dashboard/affiliate?editListing=${encodeURIComponent(listingId)}`
}

export function wholesaleChangePushCopy(args: {
  productName: string
  atLoss: boolean
  variantCount: number
}): { title: string; body: string } {
  const variantNote =
    args.variantCount > 0 ? `${args.variantCount} variante(s) à revoir` : "revoyez votre marge"
  const lossNote = args.atLoss ? " · risque de perte" : ""
  return {
    title: "Prix fournisseur en hausse",
    body: `« ${args.productName} » — ${variantNote}${lossNote}`,
  }
}

export async function sendWholesaleChangePushToUser(
  payload: WholesaleChangePushPayload
): Promise<number> {
  const copy = wholesaleChangePushCopy(payload)
  return sendPushToUser(payload.userId, {
    title: copy.title,
    body: copy.body,
    url: wholesaleChangePushUrl(payload.listingId),
    tag: `affisell-wholesale-${payload.listingId}`,
  })
}

export function abandonedCartPushCopy(args: {
  productName: string
  priceLabel?: string
}): { title: string; body: string } {
  return {
    title: `Panier en attente · ${args.productName}`,
    body: args.priceLabel
      ? `Votre article vous attend — ${args.priceLabel}`
      : "Finalisez votre commande en un clic.",
  }
}

export async function sendAbandonedCartPushToUser(
  payload: AbandonedCartPushPayload
): Promise<number> {
  const copy = abandonedCartPushCopy(payload)
  return sendPushToUser(payload.userId, {
    title: copy.title,
    body: copy.body,
    url: payload.recoveryUrl,
    tag: "affisell-abandoned-cart",
  })
}
