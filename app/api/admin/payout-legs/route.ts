import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { confirmLegNotPaid, reconcileLeg } from "@/lib/payouts/leg-transfer.server"
import { prisma } from "@/lib/prisma"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ADMIN — payout legs waiting for a decision (docs/PAYOUT-LEG-REGISTRY.md §5).
 * GET: legs IN_DOUBT / PROCESSING (most recent first). Read-only; no Stripe call.
 */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const legs = await prisma.payoutLeg.findMany({
      where: { state: { in: ["IN_DOUBT", "PROCESSING"] } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        legKey: true,
        kind: true,
        role: true,
        state: true,
        generation: true,
        rail: true,
        amountCents: true,
        currency: true,
        inDoubtReason: true,
        inDoubtAt: true,
        claimedAt: true,
        attemptCount: true,
        lastErrorCode: true,
      },
    })
    return NextResponse.json({ legs })
  } catch {
    return NextResponse.json({ error: "registry_unavailable" }, { status: 503 })
  }
}

/**
 * POST `{ legKey, action: "reconcile" }` — searches Stripe and ADOPTS the leg's transfer if exactly one consistent transfer
 * exists. Never creates a transfer.
 * POST `{ legKey, action: "confirm_not_paid", note }` — closes a doubt as "nothing was paid" ONLY after the safety delay and
 * a complete Stripe search finding nothing; the next run then pays under a new generation (new idempotency key).
 */
export async function POST(req: Request) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await req.json().catch(() => null)) as { legKey?: unknown; action?: unknown; note?: unknown } | null
  const legKey = typeof body?.legKey === "string" ? body.legKey.trim().slice(0, 300) : ""
  if (!legKey) return NextResponse.json({ error: "leg_key_required" }, { status: 400 })
  const actor = `admin:${gate.session.user.id}`
  try {
    if (body?.action === "reconcile") {
      return NextResponse.json(await reconcileLeg(legKey, { actor }))
    }
    if (body?.action === "confirm_not_paid") {
      const note = typeof body.note === "string" ? body.note : ""
      const result = await confirmLegNotPaid(legKey, { actor, note })
      return NextResponse.json(result, { status: result.result === "confirmed" ? 200 : 409 })
    }
  } catch {
    return NextResponse.json({ error: "registry_unavailable" }, { status: 503 })
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 })
}
