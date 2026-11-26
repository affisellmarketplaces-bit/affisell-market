import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadQualityEffectReport } from "@/lib/listing-quality/quality-effect.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ADMIN, read-only: does sheet quality go with sales? Aggregates only; associations, never causes. */
export async function GET() {
  const admin = await requireAdminSession()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  try {
    return NextResponse.json(await loadQualityEffectReport())
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
