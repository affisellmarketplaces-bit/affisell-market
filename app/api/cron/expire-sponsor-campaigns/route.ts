import { NextResponse } from "next/server"

import { expireSponsorCampaigns } from "@/lib/sponsor/expire-sponsor-campaigns"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await expireSponsorCampaigns()
  return NextResponse.json(result)
}
