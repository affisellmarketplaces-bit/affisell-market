import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { applyOwedTransferResume, planOwedTransferResume } from "@/lib/transfers/owed-resume.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN — SIMULATION: what resuming the transfers owed to partners without Connect would do. Writes nothing. */
export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const raw = Number(new URL(req.url).searchParams.get("days"))
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), 730) : 180
  return NextResponse.json(await planOwedTransferResume(days))
}

/**
 * ADMIN — creates the PENDING transfer rows for `{ orderIds }` (the `process-transfers` cron then pays them).
 * Refused (409 `mode_off`) unless OWED_TRANSFER_RESUME_MODE=enforce — a founder decision; the default is off.
 */
export async function POST(req: Request): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: { orderIds?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter((x): x is string => typeof x === "string" && x.length > 0) : []
  if (orderIds.length === 0) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const result = await applyOwedTransferResume({ adminId: gate.session.user.id, orderIds })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json(result)
}
