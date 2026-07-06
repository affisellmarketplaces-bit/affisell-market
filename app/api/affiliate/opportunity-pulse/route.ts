import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadAffiliateOpportunityPulsePicks } from "@/lib/affiliate-catalog-opportunity-pulse"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const limitRaw = request.nextUrl.searchParams.get("limit")
  const limit = limitRaw ? Math.min(8, Math.max(1, Number(limitRaw) || 3)) : 3

  try {
    const picks = await loadAffiliateOpportunityPulsePicks(session.user.id, limit)
    return NextResponse.json({ picks })
  } catch (error) {
    console.error("[affiliate/opportunity-pulse]", error)
    return NextResponse.json({ picks: [], ...dbUnavailablePayload(error) }, { status: 503 })
  }
}
