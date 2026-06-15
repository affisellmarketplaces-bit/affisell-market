import { NextRequest, NextResponse } from "next/server"

import {
  buildExpansionDeliveredCsv,
  expansionDeliveredCsvFilename,
} from "@/lib/admin/build-expansion-delivered-csv"
import { loadExpansionDeliveredRows } from "@/lib/admin/load-expansion-delivered-rows"
import { normalizeExpansionEmailKindFilter } from "@/lib/expansion/normalize-expansion-email-kind-filter"
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

  const emailKind = normalizeExpansionEmailKindFilter(req.nextUrl.searchParams.get("emailKind"))

  const rows = await loadExpansionDeliveredRows(countryIso2, emailKind)
  const csv = buildExpansionDeliveredCsv(rows)
  const filename = expansionDeliveredCsvFilename(countryIso2, emailKind)

  console.log("[expansion-rollout]", {
    userId: gate.session.user.id,
    countryIso2: countryIso2 ?? null,
    emailKind: emailKind ?? null,
    rows: rows.length,
    result: "delivered_export",
  })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
