import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { readUnsellableAlertsMode } from "@/lib/reseller-replacement/unsellable-alerts"
import { loadUnsellableObservations } from "@/lib/reseller-replacement/unsellable-alerts.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: what the « unsellable product » notice WOULD have done while it stays in `observe` — daily
 * aggregates (counts only: no listing, reseller or product), the volume of bell notices `enforce` would have sent
 * and how many the resellers' preferences would have blocked. Sends nothing, changes nothing.
 */
export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const days = Number(new URL(req.url).searchParams.get("days") ?? "30")
  const report = await loadUnsellableObservations(Number.isFinite(days) ? Math.round(days) : 30)
  return NextResponse.json({ mode: readUnsellableAlertsMode(), ...report })
}
