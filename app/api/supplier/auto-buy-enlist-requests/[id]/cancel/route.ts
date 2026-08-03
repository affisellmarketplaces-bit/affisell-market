import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { cancelAutoBuyEnlistRequest } from "@/lib/auto-buy-enlist-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/supplier/auto-buy-enlist-requests/[id]/cancel
 * Annule une demande encore en revue.
 */
export async function POST(_req: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const result = await cancelAutoBuyEnlistRequest({
    requestId: id,
    supplierId: session.user.id,
  })

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 409
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, request: result.request })
}
