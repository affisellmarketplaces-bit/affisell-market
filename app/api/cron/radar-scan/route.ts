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
 * Auth: Bearer ${CRON_SECRET} (or x-cron-secret). Dev without secret allowed via authorizeCronRequest.
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

  try {
    const seeded = await seedWorldRadarCountries().catch((err) => {
      console.warn("[RADAR]", {
        result: "seed_countries_skipped",
        message: err instanceof Error ? err.message : "unknown",
      })
      return 0
    })
    const results = await scanAndPersistCountries(countries)
    return NextResponse.json({
      ok: true,
      batchIndex,
      countries,
      seeded,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    console.error("[RADAR]", {
      result: "cron_failed_graceful",
      message,
      hint: /market_intelli|does not exist|P2021/i.test(message)
        ? "Run npm run radar:db:push first"
        : undefined,
    })
    return NextResponse.json({
      ok: false,
      degraded: true,
      batchIndex,
      countries,
      error: message,
      hint: "Tables missing? Run npm run radar:db:push — cron will not crash the deploy.",
    })
  }
}
