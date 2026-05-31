import { NextResponse } from "next/server"

import { retryAdminAutoBuyFulfillmentLog } from "@/lib/admin/auto-fulfill/retry-auto-buy"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await ctx.params
  const result = await retryAdminAutoBuyFulfillmentLog(id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    fulfillmentLogId: result.fulfillmentLogId,
    queue: result.queue,
  })
}
