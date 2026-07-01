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

export async function notifyOrderShippedPush(args: {
  customerEmail: string
  orderId: string
  productName: string
  trackingNumber?: string | null
}): Promise<void> {
  const userId = await resolveBuyerUserIdByEmail(args.customerEmail)
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
  customerEmail: string
  orderId: string
  productName: string
}): Promise<void> {
  const userId = await resolveBuyerUserIdByEmail(args.customerEmail)
  if (!userId) return

  const count = await sendOrderStatusPushToUser({
    userId,
    orderId: args.orderId,
    productName: args.productName,
    kind: "delivered",
  })
  console.log("[order-push]", { orderId: args.orderId, kind: "delivered", sent: count })
}
