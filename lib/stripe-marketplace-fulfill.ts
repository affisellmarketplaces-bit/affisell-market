import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { buyerEarnCentsForLinePaid } from "@/lib/buyer-reward-earn"
import { earnBuyerRewardIdempotent, redeemBuyerRewardIdempotent } from "@/lib/buyer-reward-ledger"
import { resolveBuyerUserIdForEarn } from "@/lib/buyer-reward-resolve-user"

function parseLinePaids(raw: string | undefined | null): number[] | null {
  if (!raw?.trim()) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return null
    return v.map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n))
  } catch {
    return null
  }
}

export async function fulfillMarketplaceStripeSession(
  session: Stripe.Checkout.Session,
  shippingAddress: Prisma.InputJsonValue,
  customerEmail: string
): Promise<void> {
  const sessionId = session.id
  const meta = session.metadata ?? {}
  const buyerUserId = meta.buyerUserId?.trim() || ""
  const appliedRewardCents = Math.max(0, Math.round(parseInt(meta.appliedRewardCents ?? "0", 10) || 0))
  const linePaids = parseLinePaids(meta.linePaids)

  const cartLinesRaw = meta.cartLines?.trim()
  if (cartLinesRaw) {
    let lines: { affiliateProductId: string; qty: number }[] = []
    try {
      lines = JSON.parse(cartLinesRaw) as { affiliateProductId: string; qty: number }[]
    } catch {
      return
    }
    if (!Array.isArray(lines) || lines.length === 0) return

    const stripeIds = lines.map((l) => `${sessionId}:${l.affiliateProductId}`)
    const already = await prisma.order.findMany({
      where: { stripeSessionId: { in: stripeIds } },
    })
    if (already.length >= lines.length) return

    await prisma.$transaction(async (tx) => {
      const earnUserId = await resolveBuyerUserIdForEarn(tx, buyerUserId, customerEmail)

      if (buyerUserId && appliedRewardCents > 0) {
        const r = await redeemBuyerRewardIdempotent(tx, {
          userId: buyerUserId,
          amountCents: appliedRewardCents,
          stripeSessionId: sessionId,
        })
        if (!r.ok) {
          throw new Error(`buyer_redeem_failed:${r.reason}`)
        }
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const stripeSessionId = `${sessionId}:${line.affiliateProductId}`
        const dup = await tx.order.findUnique({ where: { stripeSessionId } })
        if (dup) continue

        const qty = Math.max(1, Math.round(Number(line.qty)) || 1)
        const listing = await tx.affiliateProduct.findUnique({
          where: { id: line.affiliateProductId },
          include: { product: true },
        })

        if (!listing?.product || !listing.isListed || !listing.product.active) {
          continue
        }

        const listLineCents = listing.sellingPriceCents * qty
        const paidLineCents =
          linePaids && linePaids.length === lines.length && linePaids[i] != null
            ? Math.min(listLineCents, Math.max(0, linePaids[i]!))
            : listLineCents

        const basePriceCents = listing.product.basePriceCents * qty
        const marginCents = Math.max(0, paidLineCents - basePriceCents)
        const rate = listing.product.commissionRate
        const affiliatePayoutCents = Math.floor((marginCents * rate) / 100)
        const commissionCents = affiliatePayoutCents

        const order = await tx.order.create({
          data: {
            stripeSessionId,
            productId: listing.productId,
            affiliateProductId: listing.id,
            supplierId: listing.product.supplierId,
            affiliateId: listing.affiliateId,
            buyerUserId: earnUserId || null,
            customerEmail,
            quantity: qty,
            shippingAddress,
            basePriceCents,
            sellingPriceCents: paidLineCents,
            commissionCents,
            marginCents,
            affiliatePayoutCents,
            status: "paid",
          },
        })

        await tx.affiliateProduct.update({
          where: { id: listing.id },
          data: { conversions: { increment: qty } },
        })

        await tx.notification.create({
          data: {
            userId: listing.product.supplierId,
            type: "NEW_ORDER",
            message: `New order · ${listing.product.name} ×${qty} · ship to ${customerEmail}`,
            orderId: order.id,
          },
        })

        if (earnUserId) {
          const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
          await earnBuyerRewardIdempotent(tx, {
            userId: earnUserId,
            amountCents: earn,
            stripeSessionId: sessionId,
            affiliateProductId: listing.id,
            orderId: order.id,
          })
        }
      }
    })

    return
  }

  const existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId } })
  if (existing) return

  const affiliateProductId = meta.affiliateProductId?.trim()
  if (!affiliateProductId) return

  const listing = await prisma.affiliateProduct.findUnique({
    where: { id: affiliateProductId },
    include: { product: true },
  })

  if (!listing?.product || !listing.isListed || !listing.product.active) {
    return
  }

  const qty = Math.max(1, Math.round(parseInt(meta.checkoutQty ?? "1", 10) || 1))
  const listLineCents = listing.sellingPriceCents * qty
  const paids = linePaids
  const paidLineCents =
    paids && paids.length >= 1 ? Math.min(listLineCents, Math.max(0, paids[0]!)) : listLineCents

  await prisma.$transaction(async (tx) => {
    const dup = await tx.order.findUnique({ where: { stripeSessionId: sessionId } })
    if (dup) return

    const earnUserId = await resolveBuyerUserIdForEarn(tx, buyerUserId, customerEmail)

    if (buyerUserId && appliedRewardCents > 0) {
      const r = await redeemBuyerRewardIdempotent(tx, {
        userId: buyerUserId,
        amountCents: appliedRewardCents,
        stripeSessionId: sessionId,
      })
      if (!r.ok) {
        throw new Error(`buyer_redeem_failed:${r.reason}`)
      }
    }

    const basePriceCents = listing.product.basePriceCents * qty
    const marginCents = Math.max(0, paidLineCents - basePriceCents)
    const rate = listing.product.commissionRate
    const affiliatePayoutCents = Math.floor((marginCents * rate) / 100)
    const commissionCents = affiliatePayoutCents

    const order = await tx.order.create({
      data: {
        stripeSessionId: sessionId,
        productId: listing.productId,
        affiliateProductId: listing.id,
        supplierId: listing.product.supplierId,
        affiliateId: listing.affiliateId,
        buyerUserId: earnUserId || null,
        customerEmail,
        quantity: qty,
        shippingAddress,
        basePriceCents,
        sellingPriceCents: paidLineCents,
        commissionCents,
        marginCents,
        affiliatePayoutCents,
        status: "paid",
      },
    })

    await tx.affiliateProduct.update({
      where: { id: listing.id },
      data: { conversions: { increment: qty } },
    })

    await tx.notification.create({
      data: {
        userId: listing.product.supplierId,
        type: "NEW_ORDER",
        message: `New order · ${listing.product.name} · ship to ${customerEmail}`,
        orderId: order.id,
      },
    })

    if (earnUserId) {
      const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
      await earnBuyerRewardIdempotent(tx, {
        userId: earnUserId,
        amountCents: earn,
        stripeSessionId: sessionId,
        affiliateProductId: listing.id,
        orderId: order.id,
      })
    }
  })
}
