import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { loadAuctionArena } from "@/lib/auctions-data.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Close expired lots and seed new live auctions. Bearer ${CRON_SECRET} */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const payload = await loadAuctionArena()
  console.log("[cron.auctions-tick]", { liveLots: payload.lots.length, result: "ok" })
  return NextResponse.json({ ok: true, liveLots: payload.lots.length })
}
