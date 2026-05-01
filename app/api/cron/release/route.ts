import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

function assertCronAuthorized(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return null
  }
  const auth = req.headers.get("authorization")
  const expected = `Bearer ${secret}`
  if (auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuthorized(req)
  if (unauthorized) {
    return unauthorized
  }

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
        data: { status: "DELIVERED" },
      })
      released++
    } catch (e) {
      console.error("Release failed", order.id, e)
    }
  }

  return NextResponse.json({ released, checked: orders.length })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
