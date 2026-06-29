import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { triggerLightningPayout } from "@/lib/stripe-lightning"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const markShippedBodySchema = z.object({
  trackingNumber: z.string().min(1).max(120),
  trackingCarrier: z.string().min(1).max(80),
})

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Supplier marks an order shipped and optionally triggers Lightning Payout.
 * Auth: session user must own the order (`order.supplierId`).
 */
export async function POST(req: Request, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = markShippedBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      supplierId: true,
      supplier: { select: { id: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (session.user.id !== order.supplier.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const trackingNumber = parsed.data.trackingNumber.trim()
  const trackingCarrier = parsed.data.trackingCarrier.trim()

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shippedAt: new Date(),
      trackingNumber,
      trackingCarrier,
    },
  })

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: order.supplierId },
    select: { lightningEnabled: true },
  })

  let payoutTriggered = false
  if (supplierProfile?.lightningEnabled === true) {
    const payout = await triggerLightningPayout(orderId)
    payoutTriggered = payout.success
  }

  console.log("[mark-shipped]", { orderId, supplierId: order.supplierId, payoutTriggered })

  return NextResponse.json({ success: true, payoutTriggered })
}
