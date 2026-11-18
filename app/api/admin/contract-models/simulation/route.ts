import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { runContractSimulation } from "@/lib/contract-models/simulation.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN, READ-ONLY: the draft contract models (A, B, C1, C2) replayed on past paid orders, with every undecided rate
 * swept over a grid. A simulation — no value is chosen, no order changed, no supplier attached to a model.
 * `?days=90` (7–365).
 */
export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const days = Number(new URL(req.url).searchParams.get("days") ?? "90")
  const report = await runContractSimulation(Number.isFinite(days) ? days : 90)
  return NextResponse.json(report)
}
