import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { authorizeAdminOrCron } from "@/lib/admin/authorize-admin-or-cron"
import { fulfillmentOrchestrator } from "@/lib/fulfillment/orchestrator"
import { prisma } from "@/lib/prisma"
import {
  extractShippingCountryIso2FromAddress,
  isTrustedCarrierLabelForCountry,
} from "@/lib/trusted-carriers-shared"
import { validateShipTrackingForShip } from "@/lib/ship-tracking-validate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const trackingSchema = z
  .object({
    trackingNumber: z.string().min(1).max(120),
    trackingCarrier: z.string().min(1).max(80),
    trackingUrl: z.string().url().optional().nullable(),
  })
  .strict()

type RouteCtx = { params: Promise<{ groupId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await auth()
  const { groupId } = await ctx.params

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const group = await prisma.fulfillmentGroup.findUnique({
    where: { id: groupId },
    include: {
      items: {
        take: 1,
        include: {
          order: {
            select: { shippingAddress: true, supplierId: true },
          },
        },
      },
    },
  })

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const role = (session.user as { role?: string }).role
  const isSupplier = role === "SUPPLIER" && group.supplierId === session.user.id
  const isAdmin = role === "ADMIN"
  if (!isSupplier && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = trackingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const sampleOrder = group.items[0]?.order
  if (!sampleOrder) {
    return NextResponse.json({ error: "No order lines" }, { status: 409 })
  }

  const countryIso2 = extractShippingCountryIso2FromAddress(sampleOrder.shippingAddress)
  const carrier = parsed.data.trackingCarrier.trim()
  if (!isTrustedCarrierLabelForCountry(countryIso2, carrier)) {
    return NextResponse.json({ error: "Invalid carrier for destination country" }, { status: 400 })
  }

  const trackingCheck = await validateShipTrackingForShip({
    trackingCarrier: carrier,
    trackingNumber: parsed.data.trackingNumber.trim(),
    orderId: group.items[0]?.orderId ?? groupId,
    register: true,
  })
  if (!trackingCheck.ok) {
    return NextResponse.json({ error: trackingCheck.message, code: trackingCheck.code }, { status: 400 })
  }

  const result = await fulfillmentOrchestrator.onTrackingUpdate(
    groupId,
    trackingCheck.normalized,
    carrier,
    {
      trackingUrl: parsed.data.trackingUrl,
      source: isSupplier ? "supplier_mark_shipped" : "supplier_fulfillment_webhook",
    }
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "update_failed" }, { status: 409 })
  }

  return NextResponse.json({ ok: true, groupId })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const cron = await authorizeAdminOrCron(req)
  const session = await auth()
  const { groupId } = await ctx.params

  const isAdmin = session?.user?.id && (session.user as { role?: string }).role === "ADMIN"
  const isSupplier =
    session?.user?.id &&
    (session.user as { role?: string }).role === "SUPPLIER"

  if (!cron.ok && !isAdmin && !isSupplier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isSupplier) {
    const owned = await prisma.fulfillmentGroup.findFirst({
      where: { id: groupId, supplierId: session!.user!.id },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await fulfillmentOrchestrator.retryAutoBuy(groupId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "retry_failed" }, { status: 409 })
  }
  return NextResponse.json({ ok: true, groupId })
}
