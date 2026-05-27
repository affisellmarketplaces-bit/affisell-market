import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { placeAuctionBid } from "@/lib/auction-bid.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized", loginRequired: true }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await req.json().catch(() => ({}))) as { amountCents?: number }
  const amountCents = Number(body.amountCents)

  const result = await placeAuctionBid(userId, id, amountCents)
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "ENDED" ? 410 : result.code === "RATE" ? 429 : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    amountCents: result.amountCents,
    bidCount: result.bidCount,
  })
}
