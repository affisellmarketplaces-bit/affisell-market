import { auth } from "@/auth"
import { z } from "zod"

import { validateShipTrackingForShip } from "@/lib/ship-tracking-validate"
import { extractShippingCountryIso2FromAddress, isTrustedCarrierLabelForCountry } from "@/lib/trusted-carriers-shared"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    trackingCarrier: z.string().min(1).max(80),
    trackingNumber: z.string().min(1).max(120),
    orderId: z.string().min(1).max(64).optional(),
    countryIso2: z.string().length(2).optional(),
  })
  .strict()

/** Real-time tracking validation before supplier confirms shipment. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const carrier = parsed.data.trackingCarrier.trim()
  let countryIso2 = parsed.data.countryIso2?.toUpperCase()

  if (parsed.data.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, supplierId: session.user.id },
      select: { shippingAddress: true, customerEmail: true },
    })
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 })
    }
    countryIso2 = extractShippingCountryIso2FromAddress(order.shippingAddress)
  }

  if (!countryIso2) countryIso2 = "FR"

  if (!isTrustedCarrierLabelForCountry(countryIso2, carrier)) {
    return Response.json(
      { valid: false, code: "invalid_carrier", message: "Transporteur invalide pour ce pays." },
      { status: 200 }
    )
  }

  const result = await validateShipTrackingForShip({
    trackingCarrier: carrier,
    trackingNumber: parsed.data.trackingNumber,
    orderId: parsed.data.orderId,
    register: false,
  })

  if (!result.ok) {
    return Response.json({ valid: false, code: result.code, message: result.message }, { status: 200 })
  }

  return Response.json({
    valid: true,
    normalized: result.normalized,
    verifiedBy: result.verifiedBy,
  })
}
