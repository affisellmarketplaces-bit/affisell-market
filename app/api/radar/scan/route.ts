import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { parseRadarCountries, runRadarGlobalScan } from "@/lib/radar/crawler/global-scan"
import { checkRadarAccess, planLimitReached } from "@/lib/radar/gate-with-plan"
import { gate } from "@/lib/radar/gate"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { getRadarDb } from "@/lib/prisma-radar"
import { assertRadarScanRateLimit } from "@/lib/radar/scan-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Force Scan from Radar UI — session + feature gate (never expose CRON_SECRET to the browser).
 */
export async function POST(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const limited = await assertRadarScanRateLimit(req)
  if (limited) return limited

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const planUser = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    isPro: session.user.isPro ?? false,
    features: session.user.features,
  }
  const plan = getUserRadarPlan(planUser)
  const access = checkRadarAccess(planUser, "scan")
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? "Forbidden", plan: plan.id, upgrade: access.upgradePath },
      { status: 403 }
    )
  }

  if (resolveRadarDatabaseUrl()) {
    try {
      const count = await getRadarDb().radarGlobalSnapshot.count()
      if (planLimitReached(plan, "products", count)) {
        return NextResponse.json(
          {
            error: "Limit reached",
            plan: plan.id,
            maxProducts: plan.maxProducts,
            upgrade: "/pricing?feature=radar",
          },
          { status: 429 }
        )
      }
    } catch {
      // ignore count failure — still allow scan
    }
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { countries?: string }
    const urlCountries = new URL(req.url).searchParams.get("countries")
    const countries = parseRadarCountries(body.countries ?? urlCountries)
    const result = await runRadarGlobalScan({ countries })
    console.log("[radar/scan]", {
      userId: session.user.id,
      plan: plan.id,
      result: "ok",
      scanned: result.scanned,
      countries: result.countries,
    })
    return NextResponse.json({ started: true, ...result })
  } catch (err) {
    console.error("[radar/scan]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}
