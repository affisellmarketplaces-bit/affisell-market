import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { loadResellerListingHealth } from "@/lib/reseller-copilot.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Health of the signed-in reseller's listings, at their own selling price, today's supplier price and commission,
 * and THEIR fee rate (a negotiated `User.affiliatePlatformFeeBps` wins over the default). Read-only.
 * Every figure is an estimate (`estimated: true`), never a guaranteed margin.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const user = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { affiliatePlatformFeeBps: true },
    })
    .catch(() => null)
  const listings = await loadResellerListingHealth(session.user.id, {
    resellerFeeBps: user?.affiliatePlatformFeeBps ?? null,
  })
  const counts = { action: 0, watch: 0, ok: 0 }
  for (const l of listings) counts[l.status] += 1
  return NextResponse.json({ listings, counts, estimated: true })
}
