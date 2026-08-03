import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { approveAutoBuyEnlistRequest } from "@/lib/auto-buy-enlist-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/auto-fulfill/enlist-requests/[id]/approve
 * Approuve → Instant Enlist sous le compte du fournisseur demandeur.
 */
export async function POST(_req: Request, context: RouteContext) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id } = await context.params
  const result = await approveAutoBuyEnlistRequest({
    requestId: id,
    adminUserId: gate.session.user.id,
  })

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "not_pending"
          ? 409
          : result.error === "invalid_aliexpress_url" || result.error === "supplier_not_found"
            ? 400
            : 502
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    request: result.request,
    productId: result.productId,
    enlisted: result.enlisted,
  })
}
