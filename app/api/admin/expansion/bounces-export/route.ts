import { NextRequest, NextResponse } from "next/server"

import {
  buildExpansionBounceCsv,
  EXPANSION_BOUNCE_CSV_FILENAME,
} from "@/lib/admin/build-expansion-bounce-csv"
import { loadExpansionBounceRows } from "@/lib/admin/load-expansion-bounce-rows"
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

  const rows = await loadExpansionBounceRows(countryIso2)
  const csv = buildExpansionBounceCsv(rows)

  console.log("[expansion-rollout]", {
    userId: gate.session.user.id,
    countryIso2: countryIso2 ?? null,
    rows: rows.length,
    result: "bounces_export",
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${EXPANSION_BOUNCE_CSV_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  })
}
