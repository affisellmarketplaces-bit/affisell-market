import { NextResponse } from "next/server"

import { forceRefreshAndPersistAliExpressTokens } from "@/lib/aliexpress-oauth"
import { authorizeAliExpressOps } from "@/lib/aliexpress-ops-auth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Force AliExpress token refresh + DB persist.
 * Auth: Bearer / x-cron-secret / ?secret= / HMAC (same as order create).
 */
export async function GET(req: Request) {
  const denied = authorizeAliExpressOps(req)
  if (denied) return denied

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
