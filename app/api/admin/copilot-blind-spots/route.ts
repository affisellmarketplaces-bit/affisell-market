import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { readBlindSpotsMode } from "@/lib/reseller-copilot/blind-spots"
import { loadCopilotBlindSpotReport } from "@/lib/reseller-copilot/blind-spots.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: the copilot's blind spots — sellable products that perform per listing-day where they are listed
 * but sit below the copilot's reference group, the characteristics it under-represents, and correction rules judged on
 * a separate window (never applied). Aggregates only: no reseller, buyer or order identifier; a product is named only
 * from ≥ 3 shops; the supplier price only as a band. `mode: "off"` while `COPILOT_BLIND_SPOTS_MODE` is off (default).
 */
export async function GET(): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const mode = readBlindSpotsMode()
  if (mode === "off") return NextResponse.json({ mode, report: null })
  const report = await loadCopilotBlindSpotReport()
  return NextResponse.json({ mode, report }, { status: report ? 200 : 503 })
}
