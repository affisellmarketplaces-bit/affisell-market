import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { triggerLightningPayout } from "@/lib/stripe-lightning"
import {
  extractShippingCountryIso2FromAddress,
  isTrustedCarrierLabelForCountry,
} from "@/lib/trusted-carriers-shared"
import { validateShipTrackingForShip } from "@/lib/ship-tracking-validate"
import { recordOrderTrackingEvent } from "@/lib/order-tracking-event"
import {
  assertSupplierMayRegisterTracking,
  trackingLockWriteFields,
} from "@/lib/order-tracking-lock.shared"

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
      status: true,
      shippingAddress: true,
      trackingNumber: true,
      trackingLockedAt: true,
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

  const lockGate = assertSupplierMayRegisterTracking(order, trackingNumber)
  if (!lockGate.ok) {
    return NextResponse.json({ error: lockGate.message, code: lockGate.code }, { status: 409 })
  }

  const countryIso2 = extractShippingCountryIso2FromAddress(order.shippingAddress)
  if (!isTrustedCarrierLabelForCountry(countryIso2, trackingCarrier)) {
    return NextResponse.json(
      { error: "Invalid carrier for destination country" },
      { status: 400 }
    )
  }

  const trackingCheck = await validateShipTrackingForShip({
    trackingCarrier,
    trackingNumber,
    orderId,
    register: true,
  })
  if (!trackingCheck.ok) {
    return NextResponse.json({ error: trackingCheck.message, code: trackingCheck.code }, { status: 400 })
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "shipped",
      shippedAt: new Date(),
      trackingNumber: trackingCheck.normalized,
      trackingCarrier,
      fulfillmentStatus: "SHIPPED",
      ...trackingLockWriteFields(trackingCheck.verifiedBy),
    },
  })

  await recordOrderTrackingEvent({
    orderId,
    eventType: "TRACKING_REGISTERED",
    source: "supplier_mark_shipped",
    trackingCarrier,
    trackingNumber: trackingCheck.normalized,
    fulfillmentStatus: "SHIPPED",
    verificationMethod: trackingCheck.verifiedBy,
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
