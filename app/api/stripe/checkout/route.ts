import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    productId?: string
    affiliateId?: string
  }

  if (!body.productId) {
    return NextResponse.json({ error: "productId manquant" }, { status: 400 })
  }

  const product = await prisma.product.findUnique({ where: { id: body.productId } })
  if (!product || !product.active) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "")

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: product.price,
          product_data: { name: product.name },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/success`,
    cancel_url: `${baseUrl}/p/${product.id}`,
    metadata: {
      productId: product.id,
      affiliateId: body.affiliateId || "",
      supplierId: product.supplierId,
    },
  })

  return NextResponse.json({ url: session.url })
}
