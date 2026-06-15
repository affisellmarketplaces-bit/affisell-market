import { NextResponse } from "next/server"

import {
  loadGraduatedCheckoutCountryIso2,
  resolveLiveCheckoutCountryCount,
} from "@/lib/checkout-country-rollout"
import { MARKET_REGION } from "@/lib/market-config"

export const dynamic = "force-dynamic"

/** Live checkout country count (static base + graduated + pilot rollouts). */
export async function GET() {
  const [checkoutCountryCount, graduatedCountries] = await Promise.all([
    resolveLiveCheckoutCountryCount(MARKET_REGION),
    loadGraduatedCheckoutCountryIso2(MARKET_REGION),
  ])

  return NextResponse.json(
    {
      marketRegion: MARKET_REGION,
      checkoutCountryCount,
      graduatedCount: graduatedCountries.length,
    },
    {
      headers: { "Cache-Control": "public, max-age=300" },
    }
  )
}
