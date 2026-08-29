import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { enrichCatalogProductsWithOpportunityPulse } from "@/lib/affiliate-catalog-opportunity-pulse"
import { loadAffiliateCatalogProducts } from "@/lib/affiliate-catalog-query"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function safeDiscoverErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e ?? "unknown")
  if (/maximum call stack size exceeded/i.test(message)) {
    return "Catalog temporarily unavailable — retry in a few seconds"
  }
  return message
}

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

    let enriched = products
    try {
      enriched = await enrichCatalogProductsWithOpportunityPulse(products, session.user.id)
    } catch (pulseErr) {
      console.warn("[affiliate/discover-catalog]", {
        step: "opportunity_pulse_skipped",
        affiliateId: session.user.id,
        message: pulseErr instanceof Error ? pulseErr.message : String(pulseErr),
      })
      enriched = products.map((product) => ({
        ...product,
        affiliateCreatorsWatching: 0,
      }))
    }

    console.log("[affiliate/discover-catalog]", {
      affiliateId: session.user.id,
      count: enriched.length,
    })

    return NextResponse.json({ products: enriched })
  } catch (e) {
    console.error("[affiliate/discover-catalog]", {
      affiliateId: session.user.id,
      message: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { products: [], ...dbUnavailablePayload(e), error: safeDiscoverErrorMessage(e) },
      { status: 503 }
    )
  }
}
