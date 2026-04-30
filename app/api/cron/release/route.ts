import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST() {
  const now = new Date()

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      deliverableAt: { lte: now },
      stripePaymentIntentId: { not: null },
    },
    take: 50,
  })

  let released = 0
  for (const order of orders) {
    try {
      await stripe.paymentIntents.capture(order.stripePaymentIntentId!)
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "DELIVERED", deliveredAt: now },
      })
      released++
    } catch (e) {
      console.error("Release failed", order.id, e)
    }
  }

  return NextResponse.json({ released, checked: orders.length })
}

export async function GET() {
  return POST()
}
