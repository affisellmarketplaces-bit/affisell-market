import { NextRequest, NextResponse } from "next/server"

import {
  buildExpansionComplaintCsv,
  EXPANSION_COMPLAINT_CSV_FILENAME,
} from "@/lib/admin/build-expansion-complaint-csv"
import { loadExpansionComplaintRows } from "@/lib/admin/load-expansion-complaint-rows"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const countryRaw = req.nextUrl.searchParams.get("countryIso2")?.trim()
  const countryIso2 = countryRaw ? normalizeVisitorCountryIso2(countryRaw) : undefined
  if (countryRaw && !countryIso2) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 })
  }

  const rows = await loadExpansionComplaintRows(countryIso2)
  const csv = buildExpansionComplaintCsv(rows)

  console.log("[expansion-rollout]", {
    userId: gate.session.user.id,
    countryIso2: countryIso2 ?? null,
    rows: rows.length,
    result: "complaints_export",
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${EXPANSION_COMPLAINT_CSV_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  })
}
