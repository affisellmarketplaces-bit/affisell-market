import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { enrichCatalogProductsWithOpportunityPulse } from "@/lib/affiliate-catalog-opportunity-pulse"
import { loadAffiliateCatalogProducts } from "@/lib/affiliate-catalog-query"
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

  try {
    const takeRaw = request.nextUrl.searchParams.get("take")
    const take = takeRaw ? Math.min(120, Math.max(12, Number(takeRaw) || 96)) : 96
    const products = await loadAffiliateCatalogProducts(
      session.user.id,
      request.nextUrl.searchParams,
      take
    )
    const enriched = await enrichCatalogProductsWithOpportunityPulse(products, session.user.id)
    return NextResponse.json({ products: enriched })
  } catch (e) {
    console.error("[affiliate/discover-catalog]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}
