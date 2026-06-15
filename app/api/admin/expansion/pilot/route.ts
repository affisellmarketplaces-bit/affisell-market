import { NextResponse } from "next/server"

import { runExpansionPilot } from "@/lib/admin/expansion-pilot"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** One-click: enable top waitlist country + send launch emails. */
export async function POST() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  const result = await runExpansionPilot({ notify: true })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, detail: result.detail }, { status: 400 })
  }

  return NextResponse.json(result)
}
