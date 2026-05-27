import { NextResponse } from "next/server"

import { loadAuctionArena } from "@/lib/auctions-data.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Close expired lots and seed new live auctions. Bearer ${CRON_SECRET} */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")?.trim()
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await loadAuctionArena()
  console.log("[cron.auctions-tick]", { liveLots: payload.lots.length, result: "ok" })
  return NextResponse.json({ ok: true, liveLots: payload.lots.length })
}
