import { NextResponse } from "next/server"

import { forceRefreshAndPersistAliExpressTokens } from "@/lib/aliexpress-oauth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Cron every 12h — Authorization: Bearer ${CRON_SECRET} */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  try {
    const result = await forceRefreshAndPersistAliExpressTokens()
    console.log("[cron/aliexpress-refresh]", {
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
    console.error("[cron/aliexpress-refresh]", { result: "error", message })
    return NextResponse.json(
      { ok: false, error: message },
      { status: err instanceof AliExpressApiError ? 502 : 500 }
    )
  }
}
