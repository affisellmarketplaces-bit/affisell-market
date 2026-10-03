import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadCategoryEngineReport } from "@/lib/category-engine-accuracy.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Catalogue-learning report: how often humans keep the category the engine applied, the most frequent corrections and
 * the labelled examples. `?days=90` (1–365), `?corrections=100` (0–500).
 */
export async function GET(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  // `Number(null)` is 0: only read a parameter that was actually sent.
  const numberParam = (name: string): number => {
    const raw = url.searchParams.get(name)
    return raw === null || raw.trim() === "" ? Number.NaN : Number(raw)
  }
  const days = numberParam("days")
  const corrections = numberParam("corrections")

  const report = await loadCategoryEngineReport({
    windowDays: Number.isFinite(days) && days > 0 ? days : 90,
    correctionsLimit: Number.isFinite(corrections) && corrections >= 0 ? Math.min(500, corrections) : 100,
  })
  return NextResponse.json(report)
}
