import { sendAbandonedCartReminderEmail } from "@/lib/emails/send-abandoned-cart-reminder"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { prisma } from "@/lib/prisma"

export type RunAbandonedCartReminderOptions = {
  /** Hours of cart inactivity before first recovery email (default 1). */
  hoursAfterInactivity?: number
  limit?: number
}

export type RunAbandonedCartReminderResult = {
  processed: number
  sent: number
  skipped: number
  skippedAlreadyPurchased: number
  errors: string[]
}

async function buyerPurchasedCartListingSince(args: {
  userId: string
  customerEmail: string
  affiliateProductId: string
  since: Date
}): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: {
      affiliateProductId: args.affiliateProductId,
      status: { in: ["paid", "shipped", "delivered"] },
      createdAt: { gt: args.since },
      OR: [{ buyerUserId: args.userId }, { customerEmail: args.customerEmail }],
    },
    select: { id: true },
  })
  return order != null
}

function pickPrimaryCartItem(
  items: Array<{
    affiliateProductId: string
    quantity: number
    affiliateProduct: {
      id: string
      sellingPriceCents: number
      isListed: boolean
      product: { name: string; images: string[] | null }
    }
  }>
) {
  const listed = items.filter((row) => row.affiliateProduct.isListed)
  if (listed.length === 0) return null

  return listed.reduce((best, row) =>
    row.affiliateProduct.sellingPriceCents > best.affiliateProduct.sellingPriceCents ? row : best
  )
}

/**
 * Proactive cart recovery: email buyers who left items in cart without checkout.
 * Complements Stripe checkout.session.expired (which only fires after session TTL).
 */
export async function runAbandonedCartReminderCron(
  options: RunAbandonedCartReminderOptions = {}
): Promise<RunAbandonedCartReminderResult> {
  const hours = options.hoursAfterInactivity ?? 1
  const limit = options.limit ?? 50

  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hours)

  const carts = await prisma.cart.findMany({
    where: {
      cartAbandonmentEmailSentAt: null,
      updatedAt: { lte: cutoff },
      items: { some: {} },
      user: { email: { not: "" } },
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: {
        include: {
          affiliateProduct: {
            select: {
              id: true,
              sellingPriceCents: true,
              isListed: true,
              product: { select: { name: true, images: true } },
            },
          },
        },
      },
    },
  })

  let sent = 0
  let skipped = 0
  let skippedAlreadyPurchased = 0
  const errors: string[] = []
  const baseUrl = resolveAppUrl()

  for (const cart of carts) {
    const primary = pickPrimaryCartItem(cart.items)
    if (!primary) {
      skipped += 1
      continue
    }

    const affiliateProductId = primary.affiliateProduct.id
    const alreadyPurchased = await buyerPurchasedCartListingSince({
      userId: cart.user.id,
      customerEmail: cart.user.email,
      affiliateProductId,
      since: cart.updatedAt,
    })

    if (alreadyPurchased) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { cartAbandonmentEmailSentAt: new Date() },
      })
      skippedAlreadyPurchased += 1
      console.log("[abandoned-cart]", { cartId: cart.id, result: "skipped_already_purchased" })
      continue
    }

    const recoveryUrl =
      cart.items.length === 1
        ? `${baseUrl}/marketplace/${affiliateProductId}?ref=abandoned_cart`
        : `${baseUrl}/cart?ref=abandoned_cart`

    const result = await sendAbandonedCartReminderEmail(
      {
        customerEmail: cart.user.email,
        customerName: cart.user.name,
        affiliateProductId,
        productName: primary.affiliateProduct.product.name,
        productImages: primary.affiliateProduct.product.images,
        sellingPriceCents: primary.affiliateProduct.sellingPriceCents,
        recoveryUrl,
      },
      { locale: null }
    )

    if (!result.ok) {
      errors.push(`${cart.id}:${result.error ?? "send_failed"}`)
      skipped += 1
      continue
    }

    await prisma.cart.update({
      where: { id: cart.id },
      data: { cartAbandonmentEmailSentAt: new Date() },
    })
    sent += 1
    console.log("[abandoned-cart]", {
      cartId: cart.id,
      userId: cart.user.id,
      affiliateProductId,
      result: "reminder_sent",
    })
  }

  console.log("[abandoned-cart]", {
    processed: carts.length,
    sent,
    skipped,
    skippedAlreadyPurchased,
    hoursAfterInactivity: hours,
    result: "batch_complete",
  })

  return {
    processed: carts.length,
    sent,
    skipped,
    skippedAlreadyPurchased,
    errors,
  }
}
