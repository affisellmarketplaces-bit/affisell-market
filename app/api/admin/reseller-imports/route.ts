import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { listResellerImportsForReview } from "@/lib/reseller-import/review.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN: reseller URL imports waiting for a decision (import → validation → publication). Read-only. */
export async function GET(): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const rows = await listResellerImportsForReview()
  return NextResponse.json({ imports: rows })
}
