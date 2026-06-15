import { NextResponse } from "next/server"

import { MARKET_REGION } from "@/lib/market-config"
import { isStripeCheckoutCountry, stripeCheckoutAllowedCountries } from "@/lib/eu-market-countries"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

export const dynamic = "force-dynamic"

/** Edge geo signal for buyer UX (checkout region coming-soon banner). */
export async function GET(request: Request) {
  const country = resolveVisitorCountryIso2(request.headers)
  const checkoutAvailable = country ? isStripeCheckoutCountry(country) : true

  console.log("[visitor-region]", {
    marketRegion: MARKET_REGION,
    country,
    checkoutAvailable,
    allowedCountries: stripeCheckoutAllowedCountries().length,
  })

  return NextResponse.json(
    { country, checkoutAvailable },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    }
  )
}
