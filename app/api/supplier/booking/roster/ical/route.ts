import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import {
  buildSupplierBookingRosterIcal,
  rosterIcalFilename,
} from "@/lib/supplier-booking-roster-ical"
import { fetchSupplierBookingRoster } from "@/lib/supplier-booking-roster-payload"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  slotId: z.string().min(1).optional(),
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
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const payload = await fetchSupplierBookingRoster({
    supplierId: session.user.id,
    slotId: parsed.data.slotId,
    checkedIn: "all",
  })

  const ics = buildSupplierBookingRosterIcal(payload.rows)
  const filename = rosterIcalFilename(parsed.data.slotId)

  console.log("[booking-roster]", {
    supplierId: session.user.id,
    result: "ical_export",
    rowCount: payload.rows.length,
    slotId: parsed.data.slotId ?? null,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
