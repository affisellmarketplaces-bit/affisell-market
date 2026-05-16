import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { formatCartVariantLabel, parseCartVariantSignature } from "@/lib/cart-variant"
import { buyerEarnCentsForLinePaid } from "@/lib/buyer-reward-earn"
import { earnBuyerRewardIdempotent, redeemBuyerRewardIdempotent } from "@/lib/buyer-reward-ledger"
import { resolveBuyerUserIdForEarn } from "@/lib/buyer-reward-resolve-user"
import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

type ListingWithProduct = {
  id: string
  affiliateId: string
  productId: string
  affiliate: { store: { partnerListingCode: string } | null }
  product: {
    id: string
    name: string
    supplierId: string
    basePriceCents: number
    commissionRate: number
    active: boolean
  }
}

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

async function createPaidMarketplaceOrder(
  tx: Tx,
  args: {
    stripeSessionId: string
    listing: ListingWithProduct
    qty: number
    paidLineCents: number
    buyerUserId: string | null
    customerEmail: string
    shippingAddress: Prisma.InputJsonValue
    variantLabel: string
    partnerListingCode?: string | null
  }
): Promise<string | null> {
  const { listing, qty } = args
  const basePriceCents = listing.product.basePriceCents * qty
  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: args.paidLineCents,
    basePriceCents,
    supplierCommissionRatePercent: listing.product.commissionRate,
  })

  const order = await tx.order.create({
    data: {
      stripeSessionId: args.stripeSessionId,
      productId: listing.productId,
      affiliateProductId: listing.id,
      supplierId: listing.product.supplierId,
      affiliateId: listing.affiliateId,
      buyerUserId: args.buyerUserId,
      customerEmail: args.customerEmail,
      quantity: qty,
      shippingAddress: args.shippingAddress,
      variantLabel: args.variantLabel || null,
      basePriceCents,
      sellingPriceCents: settlement.sellingPriceCents,
      marginCents: settlement.marginCents,
      commissionCents: settlement.affiliateCommissionCents,
      affiliatePayoutCents: settlement.affiliateCommissionCents,
      affisellFeeCents: settlement.affisellFeeCents,
      affiliateMarginRetainedCents: settlement.affiliateMarginRetainedCents,
      status: "paid",
    },
  })

  await tx.affiliateProduct.update({
    where: { id: listing.id },
    data: { conversions: { increment: qty } },
  })

  const variantBit = args.variantLabel ? ` · ${args.variantLabel}` : ""
  await createMarketplaceOrderNotifications(tx, {
    orderId: order.id,
    supplierId: listing.product.supplierId,
    affiliateId: listing.affiliateId,
    productName: listing.product.name,
    variantBit,
    qty,
    customerEmail: args.customerEmail,
    partnerListingCode: args.partnerListingCode,
    settlement,
  })

  return order.id
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
    type CartLineMeta = {
      affiliateProductId: string
      qty: number
      variantSignature?: string
      variantLabel?: string
    }
    let lines: CartLineMeta[] = []
    try {
      lines = JSON.parse(cartLinesRaw) as CartLineMeta[]
    } catch {
      return
    }
    if (!Array.isArray(lines) || lines.length === 0) return

    const stripeIds = lines.map((_, i) => `${sessionId}:line:${i}`)
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
        const stripeSessionId = `${sessionId}:line:${i}`
        const dup = await tx.order.findUnique({ where: { stripeSessionId } })
        if (dup) continue

        const qty = Math.max(1, Math.round(Number(line.qty)) || 1)
        const listing = await tx.affiliateProduct.findUnique({
          where: { id: line.affiliateProductId },
          include: {
            product: true,
            affiliate: { select: { store: { select: { partnerListingCode: true } } } },
          },
        })

        if (!listing?.product || !listing.isListed || !listing.product.active) {
          continue
        }

        const listLineCents = listing.sellingPriceCents * qty
        const paidLineCents =
          linePaids && linePaids.length === lines.length && linePaids[i] != null
            ? Math.min(listLineCents, Math.max(0, linePaids[i]!))
            : listLineCents

        const sigStr = typeof line.variantSignature === "string" ? line.variantSignature : ""
        const parsed = parseCartVariantSignature(sigStr)
        const variantLabelRaw =
          typeof line.variantLabel === "string" && line.variantLabel.trim()
            ? line.variantLabel.trim()
            : formatCartVariantLabel(parsed.color, parsed.size)

        const orderId = await createPaidMarketplaceOrder(tx, {
          stripeSessionId,
          listing,
          qty,
          paidLineCents,
          buyerUserId: earnUserId || null,
          customerEmail,
          shippingAddress,
          variantLabel: variantLabelRaw,
          partnerListingCode: listing.affiliate.store?.partnerListingCode ?? null,
        })

        if (earnUserId && orderId) {
          const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
          await earnBuyerRewardIdempotent(tx, {
            userId: earnUserId,
            amountCents: earn,
            stripeSessionId: sessionId,
            affiliateProductId: listing.id,
            orderId,
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
    include: {
      product: true,
      affiliate: { select: { store: { select: { partnerListingCode: true } } } },
    },
  })

  if (!listing?.product || !listing.isListed || !listing.product.active) {
    return
  }

  const qty = Math.max(1, Math.round(parseInt(meta.checkoutQty ?? "1", 10) || 1))
  const checkoutVariantLabel = meta.checkoutVariantLabel?.trim() || ""
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

    const orderId = await createPaidMarketplaceOrder(tx, {
      stripeSessionId: sessionId,
      listing,
      qty,
      paidLineCents,
      buyerUserId: earnUserId || null,
      customerEmail,
      shippingAddress,
      variantLabel: checkoutVariantLabel,
      partnerListingCode: listing.affiliate.store?.partnerListingCode ?? null,
    })

    if (earnUserId && orderId) {
      const earn = buyerEarnCentsForLinePaid(paidLineCents, listing)
      await earnBuyerRewardIdempotent(tx, {
        userId: earnUserId,
        amountCents: earn,
        stripeSessionId: sessionId,
        affiliateProductId: listing.id,
        orderId,
      })
    }
  })
}
