import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lightweight listing click aggregate for post-share loop polling. */
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "AFFILIATE") {
    return Response.json(
      { totalClicks: 0, totalConversions: 0 },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  }

  const agg = await prisma.affiliateProduct.aggregate({
    where: { affiliateId: userId },
    _sum: { clicks: true, conversions: true },
  })

  const totalClicks = agg._sum.clicks ?? 0
  const totalConversions = agg._sum.conversions ?? 0

  console.log("[share-traffic]", { userId, totalClicks, totalConversions })

  return Response.json(
    { totalClicks, totalConversions },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
