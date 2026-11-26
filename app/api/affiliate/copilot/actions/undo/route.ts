import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { undoCopilotAction } from "@/lib/reseller-action-plan.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Undo an applied copilot action (7 days, only if the listing was not changed since). */
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
    prefix: "copilot-undo",
  })
  if (limited) return limited
  const body = (await req.json().catch(() => ({}))) as { auditId?: unknown }
  const auditId = typeof body.auditId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(body.auditId) ? body.auditId : ""
  if (!auditId) return NextResponse.json({ error: "invalid_audit_id" }, { status: 400 })
  const r = await undoCopilotAction({ affiliateId: session.user.id, auditId })
  if (r.ok) return NextResponse.json({ ok: true })
  const status = r.reason === "not_found" ? 404 : r.reason === "failed" ? 500 : r.reason === "kyc_required" ? 403 : 409
  return NextResponse.json({ ok: false, error: r.reason }, { status })
}
