import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { RGPD_REGISTRE_FILENAME, buildRgpdRegistreCsv } from "@/lib/admin/rgpd-registre-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Export CSV registre RGPD (art. 30) — admin uniquement. */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const csv = buildRgpdRegistreCsv()
  console.log("[rgpd-registre/export]", { userId: gate.session.user.id, result: "ok" })

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${RGPD_REGISTRE_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  })
}
