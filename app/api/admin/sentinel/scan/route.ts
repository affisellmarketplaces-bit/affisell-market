import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { runSentinelScan } from "@/lib/sentinel/run-scan"
import { loadSentinelDashboard } from "@/lib/sentinel/load-dashboard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const scan = await runSentinelScan({ alertNewP0: false })
  const dashboard = await loadSentinelDashboard()
  return NextResponse.json({ scan, dashboard })
}
