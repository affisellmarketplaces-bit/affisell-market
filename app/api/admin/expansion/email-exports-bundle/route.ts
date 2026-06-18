import { NextRequest, NextResponse } from "next/server"

import { buildExpansionEmailExportsBundle } from "@/lib/admin/build-expansion-email-exports-bundle"
import {
  expansionEmailExportsBundleFilename,
  type ExpansionEmailExportKind,
} from "@/lib/admin/expansion-email-export-kinds"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { normalizeExpansionEmailKindFilter } from "@/lib/expansion/normalize-expansion-email-kind-filter"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const countryRaw = req.nextUrl.searchParams.get("countryIso2")?.trim()
  const countryIso2 = countryRaw ? normalizeVisitorCountryIso2(countryRaw) ?? undefined : undefined
  if (countryRaw && !countryIso2) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 })
  }

  const emailKindRaw = normalizeExpansionEmailKindFilter(req.nextUrl.searchParams.get("emailKind"))
  const emailKind = emailKindRaw as ExpansionEmailExportKind | undefined

  const zipBuffer = await buildExpansionEmailExportsBundle(countryIso2, emailKind)
  const filename = expansionEmailExportsBundleFilename(countryIso2, emailKind)

  console.log("[expansion-rollout]", {
    userId: gate.session.user.id,
    countryIso2: countryIso2 ?? null,
    emailKind: emailKind ?? null,
    bytes: zipBuffer.byteLength,
    result: "email_exports_bundle",
  })

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
