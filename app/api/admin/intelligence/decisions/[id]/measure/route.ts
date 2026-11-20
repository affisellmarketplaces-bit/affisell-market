import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { measureDecision } from "@/lib/strategic-intelligence/journal.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN ONLY — measures a DUE decision once, from the database (idempotent: a second call returns the same result). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await ctx.params
  if (!id || id.length > 64) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const result = await measureDecision(id, { measuredById: gate.session.user.id })
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "journal_unavailable" ? 503 : 409
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json(result, { status: 200 })
}
