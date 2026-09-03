import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { FLAGS } from "@/lib/flags"

export type AffiliatePayoutSession = {
  affiliateId: string
}

export async function requireAffiliatePayoutSession(): Promise<
  AffiliatePayoutSession | NextResponse
> {
  if (!FLAGS.AFFILIATE_MULTI_PAYOUT) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return { affiliateId: session.user.id }
}

export function isAffiliatePayoutSessionError(
  value: AffiliatePayoutSession | NextResponse
): value is NextResponse {
  return value instanceof NextResponse
}
