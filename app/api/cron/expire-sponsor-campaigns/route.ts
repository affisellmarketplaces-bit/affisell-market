import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { expireSponsorCampaigns } from "@/lib/sponsor/expire-sponsor-campaigns"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await expireSponsorCampaigns()
  return NextResponse.json(result)
}
