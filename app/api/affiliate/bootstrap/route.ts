import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadAffiliateDashboardListings } from "@/lib/affiliate-dashboard-data"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { prisma } from "@/lib/prisma"

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
    const [listings, store] = await Promise.all([
      loadAffiliateDashboardListings(session.user.id),
      prisma.store.findUnique({
        where: { userId: session.user.id },
        select: { slug: true, name: true },
      }),
    ])
    return NextResponse.json({
      listings,
      storeSlug: store?.slug ?? null,
      storeName: store?.name?.trim() || null,
    })
  } catch (e) {
    console.error("[affiliate/bootstrap]", e)
    return NextResponse.json(
      {
        listings: [],
        storeSlug: null,
        storeName: null,
        ...dbUnavailablePayload(e),
      },
      { status: 503 }
    )
  }
}
