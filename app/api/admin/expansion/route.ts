import { NextResponse } from "next/server"

import { loadAdminExpansionOverview } from "@/lib/admin/load-admin-expansion-overview"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  const overview = await loadAdminExpansionOverview()
  return NextResponse.json(overview)
}
