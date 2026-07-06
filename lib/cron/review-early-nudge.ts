import { notifyOrderReviewNudgePush } from "@/lib/order-review-push"
import { prisma } from "@/lib/prisma"

export const REVIEW_EARLY_NUDGE_DAYS_AFTER_DELIVERY = 3

export type RunReviewEarlyNudgeCronOptions = {
  daysAfterDelivery?: number
  limit?: number
}

export type RunReviewEarlyNudgeCronResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
}

/**
 * J+3 after `deliveredAt`: one review push nudge per order (`reviewEarlyNudgeSentAt`).
 * J+7 email reminder remains on `reviewReminderSentAt` via `/api/cron/review-reminder`.
 */
export async function runReviewEarlyNudgeCron(
  options: RunReviewEarlyNudgeCronOptions = {}
): Promise<RunReviewEarlyNudgeCronResult> {
  const days = options.daysAfterDelivery ?? REVIEW_EARLY_NUDGE_DAYS_AFTER_DELIVERY
  const limit = options.limit ?? 50

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const orders = await prisma.order.findMany({
    where: {
      deliveredAt: { lte: cutoff, not: null },
      reviewEarlyNudgeSentAt: null,
      buyerReview: null,
      cancelledEmailSentAt: null,
      status: { not: "refunded" },
      customerEmail: { not: "" },
    },
    take: limit,
    orderBy: { deliveredAt: "asc" },
    include: {
      product: { select: { name: true } },
      affiliateProduct: { select: { id: true } },
    },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of orders) {
    const affiliateProductId = row.affiliateProduct?.id
    if (!affiliateProductId || !row.deliveredAt) {
      skipped += 1
      continue
    }

    try {
      const pushCount = await notifyOrderReviewNudgePush({
        buyerUserId: row.buyerUserId,
        customerEmail: row.customerEmail,
        orderId: row.id,
        affiliateProductId,
        productName: row.product.name,
      })

      await prisma.order.update({
        where: { id: row.id },
        data: { reviewEarlyNudgeSentAt: new Date() },
      })

      if (pushCount > 0) {
        sent += 1
      } else {
        skipped += 1
      }
    } catch (error) {
      errors.push(`${row.id}:${error instanceof Error ? error.message : String(error)}`)
      skipped += 1
    }
  }

  console.log("[review-early-nudge]", {
    processed: orders.length,
    sent,
    skipped,
    errors: errors.length,
  })

  return {
    processed: orders.length,
    sent,
    skipped,
    errors,
  }
}
