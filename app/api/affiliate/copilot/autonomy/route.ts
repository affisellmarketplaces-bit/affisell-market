import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isAutoEligibleType, parseGrant, type GrantInput } from "@/lib/copilot-autonomy"
import { grantAutonomy, listAutonomyRules, revokeAutonomy } from "@/lib/copilot-autonomy.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function affiliateId(): Promise<string | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return session.user.id
}

/** The reseller's grants (one per action type; there is no global grant). */
export async function GET() {
  const id = await affiliateId()
  if (typeof id !== "string") return id
  return NextResponse.json(await listAutonomyRules(id))
}

/** Grant ONE action type, with explicit consent and limits: { actionType, maxPriceIncreaseBps, maxRunsPerWeek, consent: true }. */
export async function POST(req: Request) {
  const id = await affiliateId()
  if (typeof id !== "string") return id
  const parsed = parseGrant((await req.json().catch(() => ({}))) as GrantInput)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  const r = await grantAutonomy({ affiliateId: id, rule: parsed.rule })
  if (r.ok) return NextResponse.json({ ok: true, rule: parsed.rule })
  return NextResponse.json({ ok: false, error: r.reason }, { status: r.reason === "unavailable" ? 503 : 500 })
}

/** Revoke ONE action type: ?actionType=reprice */
export async function DELETE(req: Request) {
  const id = await affiliateId()
  if (typeof id !== "string") return id
  const actionType = new URL(req.url).searchParams.get("actionType")
  if (!isAutoEligibleType(actionType))
    return NextResponse.json({ ok: false, error: "action_not_automatable" }, { status: 400 })
  const r = await revokeAutonomy({ affiliateId: id, actionType })
  if (r.ok) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false, error: r.reason }, { status: r.reason === "unavailable" ? 503 : 500 })
}
