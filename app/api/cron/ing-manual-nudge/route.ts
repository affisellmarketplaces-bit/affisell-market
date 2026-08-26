import { type NextRequest, NextResponse } from "next/server"

import { runIngManualNudgeCron } from "@/lib/cron/ing-manual-nudge"
import { secureBearerMatch } from "@/lib/secure-bearer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true

  const secret = process.env.CRON_SECRET?.trim()
  if (secret && secureBearerMatch(req.headers.get("authorization"), secret)) {
    return true
  }

  if (process.env.NODE_ENV !== "production") return true
  return false
}

/**
 * Daily 09:00 UTC — nudge suppliers with manual_required fulfillment groups (7d, max 1 / 48h).
 * Dry-run: `GET /api/cron/ing-manual-nudge?dry=1`
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1"
  console.log("[cron:ing-manual-nudge]", { result: "request", dryRun })

  const result = await runIngManualNudgeCron({ dryRun })

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      suppliers: result.suppliers,
      groupsCount: result.groupsCount,
    })
  }

  return NextResponse.json({ ok: true, ...result })
}
