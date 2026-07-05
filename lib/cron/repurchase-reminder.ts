import {
  sendRepurchaseReminderEmail,
  type RepurchaseReminderOrderPayload,
} from "@/lib/emails/send-repurchase-reminder"
import { prisma } from "@/lib/prisma"

export type RunRepurchaseReminderCronOptions = {
  /** Days after delivery before sending (default 30). */
  daysAfterDelivery?: number
  limit?: number
}

export type RunRepurchaseReminderCronResult = {
  processed: number
  sent: number
  skipped: number
  skippedAlreadyRepurchased: number
  errors: string[]
}

async function buyerRepurchasedSinceDelivery(args: {
  orderId: string
  customerEmail: string
  affiliateProductId: string
  deliveredAt: Date
}): Promise<boolean> {
  const later = await prisma.order.findFirst({
    where: {
      id: { not: args.orderId },
      customerEmail: args.customerEmail,
      affiliateProductId: args.affiliateProductId,
      paidAt: { gt: args.deliveredAt },
      status: { notIn: ["refunded", "cancelled"] },
    },
    select: { id: true },
  })
  return later != null
}

/**
 * J+N after `deliveredAt`: one repurchase win-back email per order (`repurchaseReminderSentAt`).
 */
export async function runRepurchaseReminderCron(
  options: RunRepurchaseReminderCronOptions = {}
): Promise<RunRepurchaseReminderCronResult> {
  const days = options.daysAfterDelivery ?? 30
  const limit = options.limit ?? 50

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const orders = await prisma.order.findMany({
    where: {
      deliveredAt: { lte: cutoff, not: null },
      repurchaseReminderSentAt: null,
      cancelledEmailSentAt: null,
      status: { notIn: ["refunded", "cancelled"] },
      customerEmail: { not: "" },
      affiliateProduct: { isListed: true },
    },
    take: limit,
    orderBy: { deliveredAt: "asc" },
    include: {
      buyer: { select: { email: true, name: true } },
      product: { select: { name: true, images: true } },
      affiliateProduct: { select: { id: true, isListed: true } },
    },
  })

  let sent = 0
  let skipped = 0
  let skippedAlreadyRepurchased = 0
  const errors: string[] = []

  for (const row of orders) {
    const affiliateProductId = row.affiliateProduct?.id
    if (!affiliateProductId || !row.deliveredAt) {
      skipped += 1
      continue
    }

    const alreadyRepurchased = await buyerRepurchasedSinceDelivery({
      orderId: row.id,
      customerEmail: row.customerEmail,
      affiliateProductId,
      deliveredAt: row.deliveredAt,
    })

    if (alreadyRepurchased) {
      await prisma.order.update({
        where: { id: row.id },
        data: { repurchaseReminderSentAt: new Date() },
      })
      skippedAlreadyRepurchased += 1
      console.log("[repurchase-reminder]", {
        orderId: row.id,
        result: "skipped_already_repurchased",
      })
      continue
    }

    const order: RepurchaseReminderOrderPayload = {
      id: row.id,
      customerEmail: row.buyer?.email ?? row.customerEmail,
      affiliateProductId,
      variantImageUrl: row.variantImageUrl,
      shippingAddress: row.shippingAddress,
      buyer: row.buyer,
      product: row.product,
    }

    const result = await sendRepurchaseReminderEmail(order, { locale: row.buyerLocale })
    if (!result.ok) {
      errors.push(`${row.id}:${result.error ?? "send_failed"}`)
      skipped += 1
      continue
    }

    await prisma.order.update({
      where: { id: row.id },
      data: { repurchaseReminderSentAt: new Date() },
    })
    sent += 1
  }

  console.log("[repurchase-reminder]", {
    processed: orders.length,
    sent,
    skipped,
    skippedAlreadyRepurchased,
    daysAfterDelivery: days,
    result: "batch_complete",
  })

  return {
    processed: orders.length,
    sent,
    skipped,
    skippedAlreadyRepurchased,
    errors,
  }
}
