import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { routing } from "@/i18n/routing"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

/** Stripe Checkout marketplace (EUR, affiliation metadata). */
export async function marketplaceCheckoutPOST(request: Request) {
  const session = await auth()
  const body = (await request.json().catch(() => ({}))) as {
    productId?: string
    affiliateId?: string
    cancelPath?: string
    successPath?: string
  }

  if (!body.productId?.trim()) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
  })
  if (!product || !product.active) {
    return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 })
  }

  const affiliateId = body.affiliateId?.trim() || ""

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")

  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/")
      ? body.cancelPath
      : "/"

  const successPathDefault = `/${routing.defaultLocale}/success`
  const successPath =
    typeof body.successPath === "string" && body.successPath.startsWith("/")
      ? body.successPath
      : successPathDefault

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: product.priceCents,
          product_data: { name: product.name },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    metadata: {
      productId: product.id,
      affiliateId,
      supplierId: product.supplierId,
      userId: session?.user?.id ?? "",
    },
    payment_intent_data: {
      metadata: {
        productId: product.id,
        affiliateId,
        supplierId: product.supplierId,
        userId: session?.user?.id ?? "",
      },
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
