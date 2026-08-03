import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { rejectAutoBuyEnlistRequest } from "@/lib/auto-buy-enlist-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  reason: z.string().max(500).optional().nullable(),
})

/**
 * POST /api/admin/auto-fulfill/enlist-requests/[id]/reject
 */
export async function POST(req: Request, context: RouteContext) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  let json: unknown = {}
  try {
    const text = await req.text()
    if (text.trim()) json = JSON.parse(text) as unknown
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const { id } = await context.params
  const result = await rejectAutoBuyEnlistRequest({
    requestId: id,
    adminUserId: gate.session.user.id,
    reason: parsed.data.reason,
  })

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 409
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, request: result.request })
}
