import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { applyCopilotAction } from "@/lib/reseller-action-plan.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ID = /^(reprice|pause|fix_margins):[A-Za-z0-9_-]{6,64}$/

/**
 * Apply ONE prepared, reversible action the reseller clicked. The server recomputes the plan and refuses an action
 * that no longer applies (409 stale). Recorded in AuditLog; undo via POST ./undo.
 */
export async function POST(req: Request) {
  // Cookie-authenticated write: refuse a cross-site origin (defense in depth on top of SameSite=lax).
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), {
    limit: 30,
    windowMs: 60_000,
    prefix: "copilot-apply",
  })
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as { actionId?: unknown }
  const actionId = typeof body.actionId === "string" ? body.actionId : ""
  if (!ID.test(actionId)) return NextResponse.json({ error: "invalid_action" }, { status: 400 })
  const r = await applyCopilotAction({ affiliateId: session.user.id, actionId })
  if (r.ok) return NextResponse.json({ ok: true, auditId: r.auditId, action: r.action })
  const status = r.reason === "stale" ? 409 : r.reason === "not_found" ? 404 : r.reason === "not_one_click" ? 400 : 500
  return NextResponse.json({ ok: false, error: r.reason }, { status })
}
