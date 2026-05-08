import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function addressFromSession(session: Stripe.Checkout.Session): Record<string, unknown> {
  const extended = session as Stripe.Checkout.Session & {
    shipping_details?: { address?: Stripe.Address | null; name?: string | null } | null
  }
  const ship = extended.shipping_details ?? null
  if (ship?.address) return { ...(ship.address as object), name: ship.name }
  const bill = session.customer_details
  if (bill?.address) return { ...(bill.address as object), name: bill.name }
  return {}
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const sessionId = session.id

    const customerEmail =
      session.customer_email ||
      session.customer_details?.email ||
      session.customer_details?.phone ||
      "unknown@checkout"

    const shippingAddress = addressFromSession(session) as Prisma.InputJsonValue

    const cartLinesRaw = session.metadata?.cartLines?.trim()
    if (cartLinesRaw) {
      let lines: { affiliateProductId: string; qty: number }[] = []
      try {
        lines = JSON.parse(cartLinesRaw) as { affiliateProductId: string; qty: number }[]
      } catch {
        return NextResponse.json({ received: true })
      }
      if (!Array.isArray(lines) || lines.length === 0) {
        return NextResponse.json({ received: true })
      }

      const stripeIds = lines.map((l) => `${sessionId}:${l.affiliateProductId}`)
      const already = await prisma.order.findMany({
        where: { stripeSessionId: { in: stripeIds } },
      })
      if (already.length >= lines.length) {
        return NextResponse.json({ received: true })
      }

      for (const line of lines) {
        const stripeSessionId = `${sessionId}:${line.affiliateProductId}`
        const dup = await prisma.order.findUnique({ where: { stripeSessionId } })
        if (dup) continue

        const qty = Math.max(1, Math.round(Number(line.qty)) || 1)
        const listing = await prisma.affiliateProduct.findUnique({
          where: { id: line.affiliateProductId },
          include: { product: true },
        })

        if (!listing?.product || !listing.isListed || !listing.product.active) {
          continue
        }

        const sellingPriceCents = listing.sellingPriceCents * qty
        const basePriceCents = listing.product.basePriceCents * qty
        const marginCents = Math.max(0, sellingPriceCents - basePriceCents)
        const rate = listing.product.commissionRate
        const affiliatePayoutCents = Math.floor((marginCents * rate) / 100)
        const commissionCents = affiliatePayoutCents

        const order = await prisma.order.create({
          data: {
            stripeSessionId,
            productId: listing.productId,
            affiliateProductId: listing.id,
            supplierId: listing.product.supplierId,
            affiliateId: listing.affiliateId,
            customerEmail,
            shippingAddress,
            basePriceCents,
            sellingPriceCents,
            commissionCents,
            marginCents,
            affiliatePayoutCents,
            status: "paid",
          },
        })

        await prisma.affiliateProduct.update({
          where: { id: listing.id },
          data: { conversions: { increment: qty } },
        })

        await prisma.notification.create({
          data: {
            userId: listing.product.supplierId,
            type: "NEW_ORDER",
            message: `New order · ${listing.product.name} ×${qty} · ship to ${customerEmail}`,
            orderId: order.id,
          },
        })
      }

      return NextResponse.json({ received: true })
    }

    const existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId } })
    if (existing) {
      return NextResponse.json({ received: true })
    }

    const affiliateProductId = session.metadata?.affiliateProductId?.trim()
    if (!affiliateProductId) {
      return NextResponse.json({ received: true })
    }

    const listing = await prisma.affiliateProduct.findUnique({
      where: { id: affiliateProductId },
      include: { product: true },
    })

    if (!listing?.product || !listing.isListed || !listing.product.active) {
      return NextResponse.json({ received: true })
    }

    const sellingPriceCents = listing.sellingPriceCents
    const basePriceCents = listing.product.basePriceCents
    const marginCents = Math.max(0, sellingPriceCents - basePriceCents)
    const rate = listing.product.commissionRate
    const affiliatePayoutCents = Math.floor((marginCents * rate) / 100)
    const commissionCents = affiliatePayoutCents

    const order = await prisma.order.create({
      data: {
        stripeSessionId: sessionId,
        productId: listing.productId,
        affiliateProductId: listing.id,
        supplierId: listing.product.supplierId,
        affiliateId: listing.affiliateId,
        customerEmail,
        shippingAddress,
        basePriceCents,
        sellingPriceCents,
        commissionCents,
        marginCents,
        affiliatePayoutCents,
        status: "paid",
      },
    })

    await prisma.affiliateProduct.update({
      where: { id: listing.id },
      data: { conversions: { increment: 1 } },
    })

    await prisma.notification.create({
      data: {
        userId: listing.product.supplierId,
        type: "NEW_ORDER",
        message: `New order · ${listing.product.name} · ship to ${customerEmail}`,
        orderId: order.id,
      },
    })
  }

  return NextResponse.json({ received: true })
}
