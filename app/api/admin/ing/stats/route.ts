import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadIngOpsStats } from "@/lib/ing/load-ing-ops-stats"
import { fulfillmentPrisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Admin Ing ops dashboard stats — manual_required nudges + escalation. */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const stats = await loadIngOpsStats(fulfillmentPrisma)
    console.log("[admin:ing:stats]", {
      result: "ok",
      manualGroups7d: stats.kpis.manualGroups7d,
      suppliers: stats.suppliers.length,
      escalations: stats.escalationCandidates.length,
    })
    return NextResponse.json(stats)
  } catch (error) {
    console.error("[admin:ing:stats]", {
      result: "error",
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "stats_failed" }, { status: 500 })
  }
}
