import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadBlockedDemandObservations } from "@/lib/supplier-demand-alerts/blocked-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN, READ-ONLY: what the supplier blocked-demand alerts measured (or sent) each day — counts only. */
export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30)
  return NextResponse.json({ rows: await loadBlockedDemandObservations(Number.isFinite(days) ? days : 30) })
}
