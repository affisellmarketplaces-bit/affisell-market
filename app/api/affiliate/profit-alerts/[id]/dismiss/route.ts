import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/affiliate/profit-alerts/:id/dismiss — hides one of the caller's OWN alerts (another reseller's: 404). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { id } = await ctx.params
  const res = await prisma.resellerProfitAlert.updateMany({
    where: { id, affiliateId: userId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  })
  if (res.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
