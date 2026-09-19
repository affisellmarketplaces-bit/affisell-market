import "server-only"

import { forceRefreshAndPersistAliExpressTokens, isTransientAliExpressFailure } from "@/lib/aliexpress-oauth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { alertAdminsAliExpressSession } from "@/lib/aliexpress-session-alert.server"

const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000

/** Shared by both refresh endpoints: refresh, verify it was persisted, and alert BEFORE the session dies. */
export async function runAliExpressRefreshJob(label: string): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const result = await forceRefreshAndPersistAliExpressTokens()
    console.log(label, { result: "ok", expiresIn: result.expiresIn, persisted: result.persisted })

    if (!result.persisted) {
      await alertAdminsAliExpressSession("not_persisted")
      return { status: 500, body: { ok: false, error: "tokens refreshed but not persisted", persisted: false } }
    }

    if (result.refreshExpiresAt && new Date(result.refreshExpiresAt).getTime() - Date.now() < EXPIRING_SOON_MS) {
      await alertAdminsAliExpressSession("expiring", `expire le ${result.refreshExpiresAt.slice(0, 10)}`)
    }

    return {
      status: 200,
      body: {
        ok: true,
        expires_in: result.expiresIn,
        access_expires_at: result.accessExpiresAt,
        refresh_expires_at: result.refreshExpiresAt,
        persisted: true,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(label, { result: "error", message })
    // A blip (network, DB) is retried by the next run; only a genuinely rejected session needs a human.
    if (!isTransientAliExpressFailure(err)) await alertAdminsAliExpressSession("refresh_failed", message)
    return { status: err instanceof AliExpressApiError ? 502 : 500, body: { ok: false, error: message } }
  }
}
