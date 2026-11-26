import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { parseDebitInput } from "@/lib/procurement-debits/register"
import { listProcurementDebits, recordProcurementDebit } from "@/lib/procurement-debits/register.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN, read-only: latest recorded movements (debits, refunds, fees) with what is allocated and what is left. */
export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const take = Number(new URL(req.url).searchParams.get("take") ?? 100)
  return NextResponse.json(await listProcurementDebits(Number.isFinite(take) ? take : 100))
}

/**
 * ADMIN: records ONE movement read from its source (statement line, Issuing transaction, paid invoice). Records only —
 * nothing is paid, refunded or changed on any order. The same (source, reference) twice → 409 `already_recorded`.
 */
export async function POST(req: Request) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const parsed = parseDebitInput(body, new Date())
  if (!parsed.ok) return NextResponse.json({ error: "invalid_body", fields: parsed.errors }, { status: 400 })
  const result = await recordProcurementDebit(parsed.value, gate.session.user.id)
  if (!result.ok) {
    const status = result.error === "register_unavailable" ? 503 : result.error === "parent_not_found" ? 404 : 409
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result, { status: 201 })
}
