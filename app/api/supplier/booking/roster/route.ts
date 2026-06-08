import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { fetchSupplierBookingRoster } from "@/lib/supplier-booking-roster-payload"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  slotId: z.string().min(1).optional(),
  checkedIn: z.enum(["pending", "checked_in", "all"]).optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    slotId: url.searchParams.get("slotId") ?? undefined,
    checkedIn: url.searchParams.get("checkedIn") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 })
  }

  const payload = await fetchSupplierBookingRoster({
    supplierId: session.user.id,
    slotId: parsed.data.slotId,
    checkedIn: parsed.data.checkedIn,
  })

  return NextResponse.json(payload)
}
