import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadActionOutcomes, loadCopilotAccuracy } from "@/lib/copilot-insights.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * How reliable the copilot is for THIS reseller: estimated vs settled vs due vs paid (never mixed), accuracy per
 * category with its volume and verdict, and the before/after verdict of every action they applied. Read-only.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const [accuracy, outcomes] = await Promise.all([
    loadCopilotAccuracy({ affiliateId: session.user.id }),
    loadActionOutcomes(session.user.id),
  ])
  return NextResponse.json({
    accuracy: { overall: accuracy.overall, byCategory: accuracy.byCategory.slice(0, 20) },
    outcomes: outcomes.outcomes,
    trackRecords: outcomes.trackRecords,
    estimated: true,
  })
}
