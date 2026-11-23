import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { readCopilotLearningMode } from "@/lib/reseller-copilot/learning"
import { loadCopilotLearningReport } from "@/lib/reseller-copilot/learning.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: what the reseller copilot's advice was followed by — funnel by status, per-situation measure,
 * automatic discoveries (false-discovery controlled), offline comparison of the current ranking with a learned one and
 * the decision sheet. Aggregates only: no reseller, product or order identifier. Changes nothing; the ranking is never
 * read from here. `mode: "off"` while `COPILOT_LEARNING_MODE` is off (default).
 */
export async function GET(): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const mode = readCopilotLearningMode()
  if (mode === "off") return NextResponse.json({ mode, report: null })
  const report = await loadCopilotLearningReport()
  return NextResponse.json({ mode, report }, { status: report ? 200 : 503 })
}
