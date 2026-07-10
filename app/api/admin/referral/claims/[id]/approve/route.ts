import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { approveReferralUgcClaim } from "@/lib/referral"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id } = await context.params
  const result = await approveReferralUgcClaim({
    claimId: id,
    adminUserId: gate.session.user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  return NextResponse.json({ ok: true, amountCents: result.amountCents })
}
