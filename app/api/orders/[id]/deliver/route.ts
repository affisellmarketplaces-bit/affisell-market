import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

/** Aligns with prisma Order after `npx prisma generate` (escrow dates). */
type OrderEscrowFields = {
  id: string
  status: string
  stripePaymentIntentId: string | null
  deliverableAt: Date | null
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const order = (await prisma.order.findUnique({
    where: { id },
  })) as OrderEscrowFields | null
  if (!order || !order.stripePaymentIntentId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "Order not in PAID status" }, { status: 400 })
  }
  if (!order.deliverableAt || new Date() < order.deliverableAt) {
    return NextResponse.json({ error: "Trop tôt" }, { status: 400 })
  }

  await stripe.paymentIntents.capture(order.stripePaymentIntentId)
  await prisma.order.update({
    where: { id },
    data: { status: "DELIVERED" },
  })
  return NextResponse.json({ ok: true })
}
