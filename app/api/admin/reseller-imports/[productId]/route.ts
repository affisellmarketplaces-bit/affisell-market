import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadResellerImportDetail } from "@/lib/reseller-import/review.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN: one reseller import, with what is needed to verify it (photos, price, safety data, listings). Read-only. */
export async function GET(_req: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { productId } = await context.params
  const detail = await loadResellerImportDetail(productId)
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ import: detail })
}
