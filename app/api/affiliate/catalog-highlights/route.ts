import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadAffiliateCatalogHighlights } from "@/lib/affiliate-catalog-query"
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
    const highlights = await loadAffiliateCatalogHighlights(
      session.user.id,
      request.nextUrl.searchParams
    )
    return NextResponse.json(highlights)
  } catch (e) {
    console.error("[affiliate/catalog-highlights]", e)
    return NextResponse.json(
      { bestSellers7d: [], newArrivals: [], highMargin: [], ...dbUnavailablePayload(e) },
      { status: 503 }
    )
  }
}
