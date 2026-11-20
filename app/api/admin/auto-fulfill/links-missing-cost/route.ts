import { NextResponse } from "next/server"

import { listLinksMissingCost } from "@/lib/admin/auto-fulfill/links-missing-cost"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/auto-fulfill/links-missing-cost — READ-ONLY. The active auto-buy AliExpress links whose cost the margin gate
 * reads as UNKNOWN (price or shipping of 0 / absent) and will therefore refuse. Admin session only. Writes nothing.
 */
export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  return NextResponse.json(await listLinksMissingCost())
}
