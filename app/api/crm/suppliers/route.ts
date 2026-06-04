import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { fetchSupplierPipelineFromNotion } from "@/lib/crm/notion-supplier-pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Liste pipeline fournisseurs (lecture Notion) — admin uniquement. */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { rows, error } = await fetchSupplierPipelineFromNotion()
  console.log("[api/crm/suppliers]", {
    userId: gate.session.user.id,
    rows: rows.length,
    error,
    result: error ? "error" : "ok",
  })

  return NextResponse.json({ rows, error })
}
