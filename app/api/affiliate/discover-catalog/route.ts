import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  AFFILIATE_DISCOVER_CATALOG_LIMIT,
  loadAffiliateDiscoverCatalog,
} from "@/lib/affiliate-dashboard-data"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const products = await loadAffiliateDiscoverCatalog(session.user.id, {
      take: AFFILIATE_DISCOVER_CATALOG_LIMIT,
    })
    return NextResponse.json({ products })
  } catch (e) {
    console.error("[affiliate/discover-catalog]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}
