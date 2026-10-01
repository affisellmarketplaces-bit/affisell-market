import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { gate } from "@/lib/radar/gate"
import { RADAR_DEFAULT_COUNTRY } from "@/lib/radar/dashboard-country.server"
import { redactRadarPayloadForRole } from "@/lib/radar/radar-price-veil"
import { getWorldRadarPayload } from "@/lib/radar/world-radar-store.server"
import { consumeWinnersQuota, winnersQuotaCapForPlan } from "@/lib/growth/winners-quota.server"

export const runtime = "nodejs"
/** Auth forces per-request; winners themselves TTL 6h in market_intelli (expiresAt). */
export const revalidate = 21600

const CACHE_HEADERS = {
  // Private (session) + long SWR — avoid Cache-Control: no-store on every hit
  "Cache-Control": "private, max-age=60, stale-while-revalidate=21600",
}

/**
 * GET /api/radar?country=FR
 * World Radar winners + trending keywords (cache → cold scan → mock fallback).
 * SUPPLIER responses redact reseller market prices (Price Veil).
 */
export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  let country: string = RADAR_DEFAULT_COUNTRY
  try {
    const url = new URL(req.url)
    country = (url.searchParams.get("country") ?? RADAR_DEFAULT_COUNTRY).trim().toUpperCase()
  } catch {
    country = RADAR_DEFAULT_COUNTRY
  }

  try {
    const payload = await getWorldRadarPayload(country)
    const role = session.user.role
    const safe = redactRadarPayloadForRole(payload, role)

    // Growth weekly winners quota (Lanceur: 50/week, else 10/week) — truncate, never hard-block.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { growthPlan: true },
    })
    const cap = winnersQuotaCapForPlan(user?.growthPlan)
    const quota = await consumeWinnersQuota(session.user.id, safe.winners.length, cap)
    const truncatedWinners = safe.winners.slice(0, quota.allowed)

    console.log("[api/radar]", {
      userId: session.user.id,
      role,
      country,
      winners: truncatedWinners.length,
      winnersBeforeQuota: safe.winners.length,
      quotaCap: cap,
      quotaRemaining: quota.remaining,
      priceVeiled: role === "SUPPLIER",
      source: safe.source,
    })
    return NextResponse.json(
      { ...safe, winners: truncatedWinners, quota: { cap, remaining: quota.remaining } },
      { headers: CACHE_HEADERS }
    )
  } catch (err) {
    console.error("[api/radar]", {
      country,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "RADAR_FETCH_FAILED" }, { status: 500 })
  }
}
