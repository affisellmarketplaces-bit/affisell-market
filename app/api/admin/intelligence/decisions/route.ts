import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { loadIntelligenceCockpit } from "@/lib/strategic-intelligence/collect.server"
import { validateDecisionInput } from "@/lib/strategic-intelligence/journal"
import { recordDecision } from "@/lib/strategic-intelligence/journal.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN ONLY — records a decision about a cockpit signal. The signal is looked up in the cockpit the SERVER computes
 * now (the browser only names it): its evidence is stored as it is today, never as a client sent it. A signal that is
 * no longer raised answers 409 `signal_not_current`. The baseline of a measurable signal is measured here too.
 * Recording a decision changes nothing else: no price, no product, no money.
 */
export async function POST(req: Request): Promise<Response> {
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
  const input = validateDecisionInput(body)
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })

  const cockpit = await loadIntelligenceCockpit()
  const signal = cockpit.signals.find((s) => s.id === input.value.signalId)
  if (!signal) return NextResponse.json({ error: "signal_not_current" }, { status: 409 })

  const result = await recordDecision({ signal, ...input.value, decidedById: gate.session.user.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "decision_already_open" ? 409 : 503 })
  }
  return NextResponse.json({ id: result.id, measurable: result.measurable }, { status: 201 })
}
