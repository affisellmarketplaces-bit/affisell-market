import { NextResponse } from "next/server"

import { loadAdminTerminalOverview } from "@/lib/admin/terminal/load-terminal-overview"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const overview = await loadAdminTerminalOverview()
  return NextResponse.json(overview)
}
