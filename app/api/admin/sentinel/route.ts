import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadSentinelDashboard } from "@/lib/sentinel/load-dashboard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const dashboard = await loadSentinelDashboard()
  return NextResponse.json(dashboard)
}
