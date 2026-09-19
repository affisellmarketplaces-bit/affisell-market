import "server-only"

import { forceRefreshAndPersistAliExpressTokens, isTransientAliExpressFailure } from "@/lib/aliexpress-oauth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import { alertAdminsAliExpressSession } from "@/lib/aliexpress-session-alert.server"
import { loadAliExpressTokenState } from "@/lib/aliexpress-token-store"

/**
 * AliExpress refresh tokens live only 48h (refresh_expires_in = 172800) and each successful refresh renews them.
 * A healthy job therefore always sees ~48h left; alert only when a run was clearly missed (<12h left).
 */
const EXPIRING_SOON_MS = 12 * 60 * 60 * 1000

/** A token refreshed less than this long ago is left alone (multiple triggers run — never rotate twice for nothing). */
const FRESH_ACCESS_WINDOW_MS = 21 * 60 * 60 * 1000

/**
 * Shared by every refresh trigger (GitHub Actions every 3h, Vercel cron, manual): refresh, verify it was
 * persisted, and alert BEFORE the session dies. Idempotent — redundant triggers are safe and cheap.
 */
export async function runAliExpressRefreshJob(
  label: string,
  opts?: { force?: boolean }
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    if (!opts?.force) {
      const state = await loadAliExpressTokenState()
      if (
        state.status === "ok" &&
        state.tokens.accessExpiresAt &&
        state.tokens.accessExpiresAt.getTime() - Date.now() > FRESH_ACCESS_WINDOW_MS &&
        (!state.tokens.refreshExpiresAt || state.tokens.refreshExpiresAt.getTime() - Date.now() > EXPIRING_SOON_MS)
      ) {
        console.log(label, { result: "skipped_fresh" })
        return {
          status: 200,
          body: {
            ok: true,
            skipped: "fresh",
            access_expires_at: state.tokens.accessExpiresAt.toISOString(),
            refresh_expires_at: state.tokens.refreshExpiresAt?.toISOString() ?? null,
          },
        }
      }
    }

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
