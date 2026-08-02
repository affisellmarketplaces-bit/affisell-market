import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { forceRefreshAndPersistAliExpressTokens } from "@/lib/aliexpress-oauth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function authorizeAliExpressRefresh(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? ""
  const url = new URL(req.url)
  const querySecret = url.searchParams.get("secret")?.trim() ?? ""
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? ""

  if (!cronSecret) {
    if (mustEnforceProductionSecrets()) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
    }
    return null
  }

  // Manual test: ?secret=CRON_SECRET
  if (querySecret && safeEqual(querySecret, cronSecret)) return null

  // Vercel Cron / ops: x-cron-secret
  if (headerSecret && safeEqual(headerSecret, cronSecret)) return null

  // Also accept Authorization: Bearer (shared Affisell cron pattern)
  return authorizeCronRequest(req)
}

/**
 * Force AliExpress token refresh + DB persist.
 * Auth (any one):
 * - `x-cron-secret: ${CRON_SECRET}` (Vercel Cron / ops)
 * - `?secret=${CRON_SECRET}` (manual curl)
 * - `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: Request) {
  const denied = authorizeAliExpressRefresh(req)
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
