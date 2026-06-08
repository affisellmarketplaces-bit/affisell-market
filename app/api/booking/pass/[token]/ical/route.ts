import { NextResponse } from "next/server"

import {
  buildBuyerBookingPassIcal,
  buyerPassIcalFilename,
} from "@/lib/booking/buyer-pass-ical"
import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { isBookableListingKind } from "@/lib/booking/types"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const trimmed = token?.trim()
  if (!trimmed || trimmed.length < 16) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 })
  }

  const order = await prisma.order.findFirst({
    where: { bookingToken: trimmed },
    select: {
      id: true,
      bookingSnapshot: true,
      bookingConfirmedAt: true,
      bookingCancelledAt: true,
      bookingToken: true,
      listingKindSnapshot: true,
      product: { select: { name: true } },
    },
  })

  if (!order?.bookingConfirmedAt || order.bookingCancelledAt || !order.bookingToken) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (!isBookableListingKind(order.listingKindSnapshot)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const snapshot = parseBookingSnapshot(order.bookingSnapshot)
  if (!snapshot) {
    return NextResponse.json({ error: "invalid_snapshot" }, { status: 404 })
  }

  const ics = buildBuyerBookingPassIcal({
    orderId: order.id,
    productName: order.product.name,
    bookingToken: order.bookingToken,
    snapshot,
    passBaseUrl: resolveAppUrl(),
  })
  const filename = buyerPassIcalFilename(order.id)

  console.log("[booking-pass]", { orderId: order.id, result: "ical_export" })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
