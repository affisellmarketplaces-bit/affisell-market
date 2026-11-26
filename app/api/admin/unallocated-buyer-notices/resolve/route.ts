import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resolveBuyerNoticeInDoubt } from "@/lib/unallocated-buyer-notice.server"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  sessionId: z.string().regex(/^cs_[A-Za-z0-9_]{6,200}$/),
  kind: z.enum(["initial", "refund_confirmed"]),
  attempt: z.number().int().min(1).max(5),
  outcome: z.enum(["sent", "failed"]),
  note: z.string().max(500).optional(),
})

/**
 * POST /api/admin/unallocated-buyer-notices/resolve — the human way out of a buyer notice IN DOUBT (claimed, no outcome
 * recorded, past the 24 h Resend recovery window or refused by Resend as a payload conflict), after LOOKING at Resend's
 * logs for its idempotency key. Records `sent` or `failed` for that attempt; sends nothing. Admin session only; audited
 * (the outcome row carries the admin id).
 */
export async function POST(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const result = await resolveBuyerNoticeInDoubt({ ...parsed.data, actorId: auth.session.user.id })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "claim_not_found" ? 404 : 409 })
  return NextResponse.json({ ok: true })
}
