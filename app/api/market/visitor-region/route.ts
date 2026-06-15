import { NextResponse } from "next/server"

import { MARKET_REGION } from "@/lib/market-config"
import {
  isRolloutOnlyCheckoutCountryResolved,
  isStripeCheckoutCountryResolved,
  resolveStripeCheckoutAllowedCountries,
} from "@/lib/checkout-country-rollout"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

export const dynamic = "force-dynamic"

/** Edge geo signal for buyer UX (checkout region coming-soon banner). */
export async function GET(request: Request) {
  const country = resolveVisitorCountryIso2(request.headers)
  const checkoutAvailable = country ? await isStripeCheckoutCountryResolved(country) : true
  const rolloutOnly =
    country && checkoutAvailable ? await isRolloutOnlyCheckoutCountryResolved(country) : false
  const allowedCountries = (await resolveStripeCheckoutAllowedCountries()).length

  console.log("[visitor-region]", {
    marketRegion: MARKET_REGION,
    country,
    checkoutAvailable,
    rolloutOnly,
    allowedCountries,
  })

  return NextResponse.json(
    { country, checkoutAvailable, rolloutOnly },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    }
  )
}
