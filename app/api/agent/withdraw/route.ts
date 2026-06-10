import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAgentContext } from "@/lib/agents/require-agent-context"
import { withdrawAgentBalance } from "@/lib/agents/withdraw-agent-balance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    amountCents: z.number().int().positive().optional(),
  })
  .strict()

/** Withdraw agent balance to Stripe Connect (full balance if amount omitted). */
export async function POST(req: Request) {
  const guard = await requireAgentContext()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  if (guard.ctx.status !== "ACTIVE") {
    return NextResponse.json({ error: "agent_not_active" }, { status: 403 })
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim()
  if (!idempotencyKey) {
    return NextResponse.json({ error: "missing_idempotency_key" }, { status: 400 })
  }

  const raw = await req.text()
  let body: z.infer<typeof bodySchema> = {}
  if (raw.trim()) {
    try {
      const json = JSON.parse(raw) as unknown
      const parsed = bodySchema.safeParse(json)
      if (!parsed.success) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 })
      }
      body = parsed.data
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 })
    }
  }

  const result = await withdrawAgentBalance({
    agentId: guard.ctx.sourcingAgentId,
    userId: guard.ctx.userId,
    idempotencyKey: `withdraw:${guard.ctx.sourcingAgentId}:${idempotencyKey}`,
    amountCents: body.amountCents,
  })

  if (!result.ok) {
    const status =
      result.error === "insufficient_balance" || result.error === "below_minimum"
        ? 400
        : result.error === "connect_required"
          ? 409
          : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    amountCents: result.amountCents,
    stripeTransferId: result.stripeTransferId,
    idempotent: result.idempotent ?? false,
  })
}
