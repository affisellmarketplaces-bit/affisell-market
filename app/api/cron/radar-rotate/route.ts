import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { WORLD_RADAR_COUNTRIES } from "@/lib/radar/world-countries"
import { getWeekNumber } from "@/lib/radar/scoring-engine"
import {
  scanAndPersistCountries,
  seedWorldRadarCountries,
} from "@/lib/radar/world-radar-store.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Weekly challenger rotation — Mondays 06:00 UTC.
 * Re-seeds all enabled countries with the current ISO week (6 new challengers each).
 * Auth: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const week = getWeekNumber(new Date())
  const countries = WORLD_RADAR_COUNTRIES.filter((c) => c.enabled).map((c) => c.code)

  console.log("[RADAR]", { result: "rotate_start", week, countries: countries.length })

  try {
    const seeded = await seedWorldRadarCountries().catch(() => 0)
    const results = await scanAndPersistCountries(countries)
    const ok = results.filter((r) => r.ok).length
    const newChallengers = ok * 6

    console.log("[RADAR]", {
      result: "rotate_done",
      week,
      rotated: ok,
      newChallengers,
    })

    return NextResponse.json({
      ok: true,
      rotated: ok,
      week,
      newChallengers,
      seeded,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    console.error("[RADAR]", { result: "rotate_failed", week, message })
    return NextResponse.json(
      {
        ok: false,
        degraded: true,
        week,
        error: message,
        hint: "Tables missing? npm run radar:db:push",
      },
      { status: 200 }
    )
  }
}
