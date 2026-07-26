import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { checkRadarAccess } from "@/lib/radar/gate-with-plan"
import { isRadarEnabled } from "@/lib/radar/gate"
import { loadRadarCountryIntel } from "@/lib/radar/map/load-country-intel.server"
import { loadRadarPlanContext } from "@/lib/radar/plan-user.server"
import { canViewResellerMarketPrice } from "@/lib/radar/radar-price-veil"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/radar/map/country?country=FR
 * Map pulse product list — RadarGlobalSnapshot 24h (same count as tooltip).
 * Never returns Affisell marketplace catalog.
 */
export async function GET(req: Request) {
  if (!isRadarEnabled()) {
    return NextResponse.json({ error: "radar_disabled" }, { status: 404 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const { planUser } = await loadRadarPlanContext({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro,
    features: session.user.features,
  })
  const mapAccess = checkRadarAccess(planUser, "map")
  if (!mapAccess.allowed) {
    return NextResponse.json(
      { error: "paywall", reason: mapAccess.reason ?? "map_locked" },
      { status: 402 }
    )
  }

  const url = new URL(req.url)
  const country = url.searchParams.get("country") ?? ""
  const takeRaw = Number(url.searchParams.get("take") ?? "60")
  const take = Number.isFinite(takeRaw) ? takeRaw : 60

  const intel = await loadRadarCountryIntel(country, { take })
  if (!intel) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 })
  }

  const veil = !canViewResellerMarketPrice(session.user.role)
  const products = veil
    ? intel.products.map((p) => ({ ...p, price: 0, currency: null }))
    : intel.products

  console.log("[api/radar/map/country]", {
    userId: session.user.id,
    country: intel.country,
    count: intel.count,
    returned: products.length,
    demo: intel.demo,
    priceVeiled: veil,
  })

  return NextResponse.json(
    { ...intel, products, priceVeiled: veil },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    }
  )
}
