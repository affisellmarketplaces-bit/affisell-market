import { NextResponse } from "next/server"

import { loadGraduatedCheckoutCountryIso2 } from "@/lib/checkout-country-rollout"
import { MARKET_REGION } from "@/lib/market-config"

export const dynamic = "force-dynamic"

/** Graduated ROW countries — permanent checkout base for filters & copy. */
export async function GET() {
  const countries = await loadGraduatedCheckoutCountryIso2(MARKET_REGION)
  return NextResponse.json(
    {
      marketRegion: MARKET_REGION,
      countries: countries.map((countryIso2) => ({
        countryIso2,
        shipsToValue: countryIso2.toLowerCase(),
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=300" },
    }
  )
}
