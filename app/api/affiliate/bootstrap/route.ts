import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadAffiliateDashboardListings } from "@/lib/affiliate-dashboard-data"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function friendlyDbError(e: unknown): string {
  const message = e instanceof Error ? e.message : "Could not load dashboard data"
  if (message.toLowerCase().includes("data transfer quota")) {
    return "Database transfer quota exceeded on your hosting plan. Upgrade the plan or wait for the monthly reset."
  }
  return message
}

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
        select: { slug: true },
      }),
    ])
    return NextResponse.json({
      listings,
      storeSlug: store?.slug ?? null,
    })
  } catch (e) {
    console.error("[affiliate/bootstrap]", e)
    return NextResponse.json(
      {
        error: friendlyDbError(e),
        listings: [],
        storeSlug: null,
      },
      { status: 503 }
    )
  }
}
