import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { getCountriesForCronBatch } from "@/lib/radar/world-countries"
import {
  scanAndPersistCountries,
  seedWorldRadarCountries,
} from "@/lib/radar/world-radar-store.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * World Radar cron — rotates 5 countries per run (6h schedule).
 * Auth: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const hour = new Date().getUTCHours()
  const batchIndex = Math.floor(hour / 6)
  let countries = getCountriesForCronBatch(batchIndex, 5)

  try {
    const url = new URL(req.url)
    const override = url.searchParams.get("countries")?.trim()
    if (override) {
      countries = override.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
    }
  } catch {
    // keep default batch
  }

  console.log("[RADAR]", { result: "cron_start", countries, batchIndex })

  const seeded = await seedWorldRadarCountries().catch(() => 0)
  const results = await scanAndPersistCountries(countries)

  return NextResponse.json({
    ok: true,
    batchIndex,
    countries,
    seeded,
    results,
  })
}
