import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { resolveSeatLayoutConfig } from "@/lib/booking/seat-layout"
import { listPublicBookingSlots } from "@/lib/booking/slot-availability"
import { isBookableListingKind, isServiceListingKind } from "@/lib/booking/types"
import { prisma } from "@/lib/prisma"

async function assertOwnProduct(supplierId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      id: true,
      listingKind: true,
      bookingDurationMinutes: true,
      bookingSeatLayout: true,
    },
  })
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const product = await assertOwnProduct(session.user.id, id)
  if (!product || !isBookableListingKind(product.listingKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rows = await prisma.bookingSlot.findMany({
    where: { productId: id, startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 120,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
      label: true,
      status: true,
    },
  })

  return NextResponse.json({
    slots: rows.map((row) => ({
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      capacity: row.capacity,
      bookedCount: row.bookedCount,
      seatsLeft: Math.max(0, row.capacity - row.bookedCount),
      label: row.label,
      status: row.status,
    })),
  })
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const product = await assertOwnProduct(session.user.id, id)
  if (!product || !isBookableListingKind(product.listingKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const startsRaw = typeof body.startsAt === "string" ? body.startsAt.trim() : ""
  const startsAt = new Date(startsRaw)
  if (!startsRaw || !Number.isFinite(startsAt.getTime())) {
    return NextResponse.json({ error: "invalid_starts_at" }, { status: 400 })
  }
  if (startsAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: "starts_at_must_be_future" }, { status: 400 })
  }

  const durationMinutes = Math.max(
    5,
    Math.min(
      480,
      product.bookingDurationMinutes ??
        (Math.round(Number(body.durationMinutes)) || 60)
    )
  )
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)
  const capacityRaw = Math.round(Number(body.capacity))
  const capacity = isServiceListingKind(product.listingKind)
    ? 1
    : Number.isFinite(capacityRaw) && capacityRaw >= 1
      ? Math.min(500, capacityRaw)
      : 30
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 120)
      : null

  const slot = await prisma.$transaction(async (tx) => {
    const created = await tx.bookingSlot.create({
      data: {
        productId: id,
        startsAt,
        endsAt,
        capacity,
        label,
        status: "OPEN",
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        bookedCount: true,
        label: true,
        status: true,
      },
    })

    const { provisionNamedSeatsForSlot } = await import("@/lib/booking/named-seats")
    await provisionNamedSeatsForSlot(tx, {
      slotId: created.id,
      capacity,
      listingKind: product.listingKind,
      seatLayout: resolveSeatLayoutConfig(product.bookingSeatLayout, product.listingKind),
    })

    return created
  })

  console.log("[booking]", { productId: id, result: "slot_created", slotId: slot.id })

  return NextResponse.json({
    slot: {
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
      seatsLeft: slot.capacity - slot.bookedCount,
      label: slot.label,
      status: slot.status,
    },
  })
}
