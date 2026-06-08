import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { countSupplierPendingBookingCheckIns } from "@/lib/supplier-booking-roster-payload"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const count = await countSupplierPendingBookingCheckIns(session.user.id)
  return NextResponse.json({ count })
}
