import { resolveOrderPushTarget } from "@/lib/order-status-push-shared"
import { prisma } from "@/lib/prisma"
import { sendOrderStatusPushToUser } from "@/lib/web-push-send"

async function resolveBuyerUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  })
  return user?.id ?? null
}

async function resolveBuyerUserId(args: {
  buyerUserId?: string | null
  customerEmail?: string | null
}): Promise<string | null> {
  const target = resolveOrderPushTarget(args)
  if (target.kind === "user_id") return target.userId
  if (target.kind === "email") return resolveBuyerUserIdByEmail(target.email)
  return null
}

export async function notifyOrderShippedPush(args: {
  buyerUserId?: string | null
  customerEmail: string
  orderId: string
  productName: string
  trackingNumber?: string | null
}): Promise<void> {
  const userId = await resolveBuyerUserId(args)
  if (!userId) return

  const count = await sendOrderStatusPushToUser({
    userId,
    orderId: args.orderId,
    productName: args.productName,
    kind: "shipped",
    detail: args.trackingNumber ? `Suivi : ${args.trackingNumber}` : null,
  })
  console.log("[order-push]", { orderId: args.orderId, kind: "shipped", sent: count })
}

export async function notifyOrderDeliveredPush(args: {
  buyerUserId?: string | null
  customerEmail: string
  orderId: string
  productName: string
  affiliateProductId?: string | null
}): Promise<void> {
  const userId = await resolveBuyerUserId(args)
  if (!userId) return

  const reviewUrl =
    args.affiliateProductId?.trim()
      ? `/marketplace/${encodeURIComponent(args.affiliateProductId.trim())}?writeReview=true&orderId=${encodeURIComponent(args.orderId)}`
      : null

  const count = await sendOrderStatusPushToUser({
    userId,
    orderId: args.orderId,
    productName: args.productName,
    kind: "delivered",
    reviewUrl,
  })
  console.log("[order-push]", { orderId: args.orderId, kind: "delivered", sent: count })
}
