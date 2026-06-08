import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import {
  buildSupplierBookingRosterCsv,
  rosterCsvFilename,
} from "@/lib/supplier-booking-roster-csv"
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
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 })
  }

  const payload = await fetchSupplierBookingRoster({
    supplierId: session.user.id,
    slotId: parsed.data.slotId,
    checkedIn: "all",
  })

  const csv = buildSupplierBookingRosterCsv(payload.rows)
  const filename = rosterCsvFilename(parsed.data.slotId)

  console.log("[booking-roster]", {
    supplierId: session.user.id,
    result: "csv_export",
    rowCount: payload.rows.length,
    slotId: parsed.data.slotId ?? null,
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
