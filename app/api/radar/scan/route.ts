import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { runRadarGlobalScan } from "@/lib/radar/crawler/global-scan"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { gate } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Force Scan from Radar UI — session + feature gate (never expose CRON_SECRET to the browser).
 */
export async function POST() {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const features = resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await runRadarGlobalScan()
    console.log("[radar/scan]", { userId: session.user.id, result: "ok", scanned: result.scanned })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[radar/scan]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}
