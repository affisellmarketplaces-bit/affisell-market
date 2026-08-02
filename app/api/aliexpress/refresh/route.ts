import { NextResponse } from "next/server"

import { forceRefreshAndPersistAliExpressTokens } from "@/lib/aliexpress-oauth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Force AliExpress token refresh + DB persist.
 * Auth: `Authorization: Bearer ${CRON_SECRET}` or `x-cron-secret: ${CRON_SECRET}`
 * (Also accepts `?secret=` for manual ops — same value as CRON_SECRET.)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const querySecret = url.searchParams.get("secret")?.trim() ?? ""
  const cronSecret = process.env.CRON_SECRET?.trim() ?? ""

  // Allow ?secret= for founder curl; still require exact match when CRON_SECRET set
  if (querySecret && cronSecret && querySecret === cronSecret) {
    // authorized via query
  } else {
    const denied = authorizeCronRequest(req)
    if (denied) return denied
  }

  try {
    const result = await forceRefreshAndPersistAliExpressTokens()
    console.log("[aliexpress-refresh]", {
      result: "ok",
      expiresIn: result.expiresIn,
      persisted: result.persisted,
    })
    return NextResponse.json({
      ok: true,
      expires_in: result.expiresIn,
      access_expires_at: result.accessExpiresAt,
      persisted: result.persisted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = err instanceof AliExpressApiError ? 502 : 500
    console.error("[aliexpress-refresh]", { result: "error", message })
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
