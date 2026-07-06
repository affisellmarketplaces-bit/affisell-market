import { resolveOrderPushTarget } from "@/lib/order-status-push-shared"
import { prisma } from "@/lib/prisma"
import { buildSuccessReviewHref } from "@/lib/success-review-href"
import { sendReviewNudgePushToUser } from "@/lib/web-push-send"

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

/** J+3 review nudge — push with deep link to verified review form. */
export async function notifyOrderReviewNudgePush(args: {
  buyerUserId?: string | null
  customerEmail: string
  orderId: string
  affiliateProductId: string
  productName: string
}): Promise<number> {
  const userId = await resolveBuyerUserId(args)
  if (!userId) return 0

  const reviewUrl = buildSuccessReviewHref(args.affiliateProductId, args.orderId)
  const sent = await sendReviewNudgePushToUser({
    userId,
    orderId: args.orderId,
    productName: args.productName,
    reviewUrl,
  })
  console.log("[review-early-nudge]", {
    orderId: args.orderId,
    result: sent > 0 ? "push_sent" : "push_skipped",
    sent,
  })
  return sent
}
