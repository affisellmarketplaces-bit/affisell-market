import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { readBlindSpotsMode } from "@/lib/reseller-copilot/blind-spots"
import { loadCopilotBlindSpotReport } from "@/lib/reseller-copilot/blind-spots.server"
import { loadPresenceSourceCoverage } from "@/lib/listing-presence/presence.server"
import { readTemporalMode } from "@/lib/reseller-copilot/temporal-opportunities"
import { loadTemporalReport } from "@/lib/reseller-copilot/temporal-opportunities.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: the copilot's blind spots — sellable products that perform per listing-day where they are listed
 * but sit below the copilot's reference group, the characteristics it under-represents, and correction rules judged on
 * a separate window (never applied). Aggregates only: no reseller, buyer or order identifier; a product is named only
 * from ≥ 3 shops; the supplier price only as a band. `mode: "off"` while `COPILOT_BLIND_SPOTS_MODE` is off (default).
 * `temporal` (separate switch `COPILOT_TEMPORAL_MODE`, off by default): opportunities read from the listing presence
 * history — withdrawn too early, sold historically but live nowhere, late sales, relistings, biased exposure — and the
 * share of presence events per declared source (how many are still « unattributed »). Same rules: aggregates only.
 */
export async function GET(): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const mode = readBlindSpotsMode()
  const temporalMode = readTemporalMode()
  const [report, temporal, sources] = await Promise.all([
    mode === "off" ? Promise.resolve(null) : loadCopilotBlindSpotReport(),
    temporalMode === "off" ? Promise.resolve(null) : loadTemporalReport(),
    temporalMode === "off" ? Promise.resolve(null) : loadPresenceSourceCoverage(),
  ])
  const failed = (mode !== "off" && !report) || (temporalMode !== "off" && !temporal)
  return NextResponse.json({ mode, report, temporalMode, temporal, presenceSources: sources }, { status: failed ? 503 : 200 })
}
