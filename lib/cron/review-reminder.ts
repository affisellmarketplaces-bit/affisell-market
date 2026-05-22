import { sendReviewReminderEmail, type ReviewReminderOrderPayload } from "@/lib/emails/send-review-reminder"
import { prisma } from "@/lib/prisma"

export type RunReviewReminderCronOptions = {
  /** Days after delivery before sending (default 7). */
  daysAfterDelivery?: number
  limit?: number
}

export type RunReviewReminderCronResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
}

/**
 * J+N after `deliveredAt`: one review reminder per order (`reviewReminderSentAt`).
 */
export async function runReviewReminderCron(
  options: RunReviewReminderCronOptions = {}
): Promise<RunReviewReminderCronResult> {
  const days = options.daysAfterDelivery ?? 7
  const limit = options.limit ?? 50

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const orders = await prisma.order.findMany({
    where: {
      deliveredAt: { lte: cutoff, not: null },
      reviewReminderSentAt: null,
      buyerReview: null,
      cancelledEmailSentAt: null,
      status: { not: "refunded" },
      customerEmail: { not: "" },
    },
    take: limit,
    orderBy: { deliveredAt: "asc" },
    include: {
      buyer: { select: { email: true, name: true } },
      product: { select: { name: true, images: true } },
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

    const order: ReviewReminderOrderPayload = {
      id: row.id,
      customerEmail: row.buyer?.email ?? row.customerEmail,
      deliveredAt: row.deliveredAt,
      affiliateProductId,
      variantImageUrl: row.variantImageUrl,
      shippingAddress: row.shippingAddress,
      buyer: row.buyer,
      product: row.product,
    }

    const result = await sendReviewReminderEmail(order)
    if (!result.ok) {
      errors.push(`${row.id}:${result.error ?? "send_failed"}`)
      skipped += 1
      continue
    }

    await prisma.order.update({
      where: { id: row.id },
      data: { reviewReminderSentAt: new Date() },
    })
    sent += 1
  }

  return {
    processed: orders.length,
    sent,
    skipped,
    errors,
  }
}
