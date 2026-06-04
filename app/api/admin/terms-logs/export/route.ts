import { NextResponse } from "next/server"

import { buildTermsLogsCsv } from "@/lib/admin/terms-logs/build-terms-logs-csv"
import { loadTermsAcceptanceLogsForAdmin } from "@/lib/admin/terms-logs/load-terms-logs"
import { TERMS_LOGS_CSV_FILENAME } from "@/lib/admin/terms-logs/types"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const rows = await loadTermsAcceptanceLogsForAdmin()
  const csv = buildTermsLogsCsv(rows)
  console.log("[terms-logs/export]", {
    userId: gate.session.user.id,
    rows: rows.length,
    result: "ok",
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${TERMS_LOGS_CSV_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  })
}
