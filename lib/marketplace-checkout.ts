import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

/** Stripe Checkout for an AffiliateProduct listing (EUR). */
export async function marketplaceCheckoutPOST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    affiliateProductId?: string
    cancelPath?: string
    successPath?: string
  }

  const affiliateProductId = body.affiliateProductId?.trim()
  if (!affiliateProductId) {
    return NextResponse.json({ error: "Missing affiliateProductId" }, { status: 400 })
  }

  const listing = await prisma.affiliateProduct.findFirst({
    where: { id: affiliateProductId, active: true },
    include: { product: true },
  })

  if (!listing || !listing.product.active || !listing.product.supplierId) {
    return NextResponse.json({ error: "Listing not found or inactive" }, { status: 404 })
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")

  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/") ? body.cancelPath : "/"

  const successPath =
    typeof body.successPath === "string" && body.successPath.startsWith("/")
      ? body.successPath
      : "/success"

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: listing.sellingPriceCents,
          product_data: {
            name: listing.product.name,
            images: listing.product.image ? [listing.product.image] : undefined,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    customer_creation: "always",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["US", "CA", "GB", "FR", "DE", "ES", "IT", "PT", "BE", "NL", "CH"],
    },
    phone_number_collection: { enabled: true },
    metadata: {
      affiliateProductId: listing.id,
      productId: listing.productId,
      supplierId: listing.product.supplierId,
      affiliateId: listing.affiliateId,
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
