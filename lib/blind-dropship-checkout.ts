import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { aggregateBlindOrderSettlement, computeBlindLineSettlement } from "@/lib/blind-dropship-settlement"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

const shippingSchema = z.object({
  name: z.string().min(1).max(200),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional(),
  postal_code: z.string().min(1).max(32),
  country: z.string().min(2).max(2),
  phone: z.string().max(40).optional(),
})

const blindCheckoutSchema = z.object({
  checkoutMode: z.literal("blind_dropship"),
  customerEmail: z.string().email(),
  shipping: shippingSchema,
  items: z
    .array(
      z.object({
        affiliateProductId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(50),
})

export type BlindDropshipCheckoutPayload = z.infer<typeof blindCheckoutSchema>

export function isBlindDropshipCheckoutPayload(v: unknown): v is BlindDropshipCheckoutPayload {
  if (!v || typeof v !== "object") return false
  return (v as { checkoutMode?: string }).checkoutMode === "blind_dropship"
}

async function loadBlindListing(affiliateProductId: string) {
  return prisma.affiliateProduct.findFirst({
    where: {
      id: affiliateProductId,
      ...buyerListedAffiliateProductWhere,
    },
    include: {
      product: true,
    },
  })
}

/** Stripe PaymentIntent checkout for blind dropship (parallel to legacy Checkout Session flow). */
export async function blindDropshipCheckoutPOST(parsed: unknown): Promise<Response> {
  const parsedBody = blindCheckoutSchema.safeParse(parsed)
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid body", details: parsedBody.error.flatten() }, { status: 400 })
  }
  const body = parsedBody.data
  const session = await auth()
  const buyerUserId = session?.user?.id?.trim() || null

  type Line = {
    affiliateProductId: string
    qty: number
    listing: NonNullable<Awaited<ReturnType<typeof loadBlindListing>>>
    supplierSku: string
    wholesaleCents: number
    linePaidCents: number
    blindSupplierId: string
    lineSettlement: ReturnType<typeof computeBlindLineSettlement>
  }

  const lines: Line[] = []
  for (const row of body.items) {
    const listing = await loadBlindListing(row.affiliateProductId)
    if (!listing) {
      return NextResponse.json({ error: "Listing not found or inactive", affiliateProductId: row.affiliateProductId }, { status: 404 })
    }
    const p = listing.product
    const sku = p.supplierSku?.trim()
    const wholesale = p.supplierWholesaleCents
    if (!sku || wholesale == null || wholesale < 0) {
      return NextResponse.json(
        {
          error: "Product is not configured for blind dropship (needs supplierSku + supplierWholesaleCents on the supplier catalog)",
          productId: p.id,
        },
        { status: 400 }
      )
    }
    const blind = await prisma.blindDropshipSupplier.findUnique({ where: { linkedUserId: p.supplierId } })
    if (!blind?.isBlindDropship || blind.apiType !== "rest") {
      return NextResponse.json(
        { error: "Supplier has no active blind-dropship REST profile", supplierUserId: p.supplierId },
        { status: 400 }
      )
    }
    const qty = row.qty
    const linePaidCents = listing.sellingPriceCents * qty
    const lineSettlement = computeBlindLineSettlement({
      linePaidCents,
      wholesaleUnitCents: wholesale,
      qty,
      supplierCommissionRatePercent: p.commissionRate,
    })
    lines.push({
      affiliateProductId: listing.id,
      qty,
      listing,
      supplierSku: sku,
      wholesaleCents: wholesale,
      linePaidCents,
      blindSupplierId: blind.id,
      lineSettlement,
    })
  }

  const orderSettlement = aggregateBlindOrderSettlement(lines.map((l) => l.lineSettlement))
  const totalPaidCents = orderSettlement.sellingPriceCents
  const totalCostCents = orderSettlement.basePriceCents
  if (totalPaidCents < 50) {
    return NextResponse.json({ error: "Order total too small" }, { status: 400 })
  }

  const affiliateId = lines[0]!.listing.affiliateId
  if (!lines.every((l) => l.listing.affiliateId === affiliateId)) {
    return NextResponse.json({ error: "Blind dropship checkout supports one affiliate per order for now" }, { status: 400 })
  }

  const stripe = getStripeClient()

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.blindDropshipOrder.create({
      data: {
        affiliateId,
        buyerUserId: buyerUserId ?? undefined,
        customerEmail: body.customerEmail.toLowerCase(),
        shippingAddress: body.shipping as object,
        totalPaidCents,
        totalCostCents,
        marginCents: orderSettlement.marginCents,
        affisellFeeCents: orderSettlement.affisellFeeCents,
        affiliateCommissionCents: orderSettlement.affiliateCommissionCents,
        affiliateMarginRetainedCents: orderSettlement.affiliateMarginRetainedCents,
        status: "pending_payment",
      },
    })
    for (const l of lines) {
      const s = l.lineSettlement
      await tx.blindDropshipOrderItem.create({
        data: {
          blindDropshipOrderId: o.id,
          affiliateProductId: l.affiliateProductId,
          productId: l.listing.productId,
          blindDropshipSupplierId: l.blindSupplierId,
          quantity: l.qty,
          supplierPriceAtOrderCents: l.wholesaleCents,
          supplierSkuAtOrder: l.supplierSku,
          linePaidCents: s.sellingPriceCents,
          marginCents: s.marginCents,
          affisellFeeCents: s.affisellFeeCents,
          affiliateCommissionCents: s.affiliateCommissionCents,
          affiliateMarginRetainedCents: s.affiliateMarginRetainedCents,
        },
      })
    }
    return o
  })

  const pi = await stripe.paymentIntents.create({
    amount: totalPaidCents,
    currency: "eur",
    receipt_email: body.customerEmail,
    automatic_payment_methods: { enabled: true },
    metadata: {
      blindDropshipOrderId: order.id,
      affiliateId,
      flow: "blind_dropship",
    },
    description: `Marketplace order ${order.id.slice(0, 12)}`,
  })

  await prisma.blindDropshipOrder.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: pi.id },
  })

  return NextResponse.json({
    clientSecret: pi.client_secret,
    blindDropshipOrderId: order.id,
    amountCents: totalPaidCents,
  })
}
