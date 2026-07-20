import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { gate } from "@/lib/radar/gate"
import { RADAR_DEFAULT_COUNTRY } from "@/lib/radar/dashboard-country.server"
import { getWorldRadarPayload } from "@/lib/radar/world-radar-store.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 3600

/**
 * GET /api/radar?country=FR
 * World Radar winners + trending keywords (cache → cold scan → mock fallback).
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
    console.log("[api/radar]", {
      userId: session.user.id,
      country,
      winners: payload.winners.length,
      source: payload.source,
    })
    return NextResponse.json(payload)
  } catch (err) {
    console.error("[api/radar]", {
      country,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "RADAR_FETCH_FAILED" }, { status: 500 })
  }
}
