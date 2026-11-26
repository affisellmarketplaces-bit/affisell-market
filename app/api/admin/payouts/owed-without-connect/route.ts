import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadOwedWithoutConnect } from "@/lib/transfers/owed-without-connect.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN, READ-ONLY: what the settlement owes to partners without a Stripe Connect account. Pays nothing. */
export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const days = Number(new URL(req.url).searchParams.get("days") ?? "180")
  const report = await loadOwedWithoutConnect(Number.isFinite(days) ? Math.min(Math.max(1, Math.round(days)), 730) : 180)
  return NextResponse.json(report)
}
