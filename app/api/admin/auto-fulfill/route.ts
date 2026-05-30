import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadAdminAutoFulfillDashboard } from "@/lib/admin/auto-fulfill/load-dashboard"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(req.url)
  const productQ = url.searchParams.get("q") ?? undefined

  const dashboard = await loadAdminAutoFulfillDashboard({ productQ })
  return NextResponse.json(dashboard)
}
