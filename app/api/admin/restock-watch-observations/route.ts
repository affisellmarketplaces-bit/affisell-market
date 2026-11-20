import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadRestockWatchObservations } from "@/lib/restock-watch/restock-watch.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: what « Prévenez-moi au retour » measured — daily snapshots (active requests, distinct buyers,
 * distinct variants), pushes `enforce` WOULD have sent (theoretical) and pushes REALLY sent, in separate columns.
 * Counts only: no buyer, listing or product. Sends nothing, changes nothing.
 */
export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const days = Number(new URL(req.url).searchParams.get("days") ?? "30")
  return NextResponse.json(await loadRestockWatchObservations(Number.isFinite(days) ? days : 30))
}
