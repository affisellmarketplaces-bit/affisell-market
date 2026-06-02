import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  SPONSOR_DURATIONS_DAYS,
  SPONSOR_PLACEMENTS,
  type SponsorDurationDays,
  type SponsorPlacement,
} from "@/lib/sponsor/sponsor-constants"
import { loadSponsorHtCents, resolveSponsorTarget } from "@/lib/sponsor/sponsor-access"
import { quoteSponsorCampaign } from "@/lib/sponsor/sponsor-pricing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  productId?: string
  affiliateProductId?: string
  sponsorRateBps?: number
  durationDays?: number
  placement?: string
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const role = session?.user?.role
  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const target = await resolveSponsorTarget(userId, role, body)
  if ("error" in target) {
    return NextResponse.json({ error: target.error }, { status: target.status })
  }

  const durationDays = Number(body.durationDays ?? 7) as SponsorDurationDays
  if (!SPONSOR_DURATIONS_DAYS.includes(durationDays)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 })
  }

  const placement = (body.placement ?? "HOME_SPOTLIGHT") as SponsorPlacement
  if (!SPONSOR_PLACEMENTS.includes(placement)) {
    return NextResponse.json({ error: "Invalid placement" }, { status: 400 })
  }

  const htCents = await loadSponsorHtCents(target)
  if (htCents <= 0) {
    return NextResponse.json({ error: "Invalid product HT price" }, { status: 400 })
  }

  const quote = quoteSponsorCampaign({
    htCents,
    sponsorRateBps: Number(body.sponsorRateBps ?? 500),
    durationDays,
    placement,
  })

  return NextResponse.json({ target, quote })
}
