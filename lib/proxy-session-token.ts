import type { NextRequest } from "next/server"
import { getToken, type JWT } from "next-auth/jwt"

/**
 * What the proxy knows about the visitor's session, read without ever throwing and without ever failing OPEN.
 *
 * Two things used to go wrong in `proxy.ts`:
 * - `getToken` throws on a malformed `Authorization: Bearer` header (`URIError: URI malformed`, no `try/catch` inside
 *   `@auth/core` 0.41.2 — GHSA-xmf8). The proxy let it escape, so the page answered 500.
 * - the page guards (supplier / affiliate / agent / admin / CRM / buyer account / legal gate) were wrapped in
 *   `if (secret)`: with no usable secret the proxy let every page through.
 *
 * Now a missing secret or an unreadable token is just "no token" — an anonymous visitor — and the guards run for them
 * like for anyone else: protected areas redirect to the login, public pages are untouched.
 */
// not `ReturnType<typeof getToken>`: getToken is overloaded and the last overload (`raw: true`) returns a string
export type ProxySessionToken = JWT | null

/**
 * The secret Auth.js signs the session with: the FIRST NON-EMPTY of `AUTH_SECRET` / `NEXTAUTH_SECRET`, exactly like
 * `env("AUTH_SECRET", "NEXTAUTH_SECRET")` in `lib/auth.ts`. The proxy used `AUTH_SECRET ?? NEXTAUTH_SECRET`, which picks an
 * EMPTY `AUTH_SECRET` over a real `NEXTAUTH_SECRET` — Auth.js kept working while the proxy silently stopped guarding.
 */
export function resolveAuthSecret(env: Record<string, string | undefined> = process.env): string | null {
  for (const key of ["AUTH_SECRET", "NEXTAUTH_SECRET"]) {
    const value = env[key]?.trim()
    if (value) return value
  }
  return null
}

const UNREADABLE_LOG_EVERY_MS = 60_000
let lastUnreadableLogAt = 0
let lastMissingSecretLogAt = 0

/** Test seam: forget when the missing-secret error was last logged. */
export function resetProxySessionTokenLogsForTests(): void {
  lastUnreadableLogAt = 0
  lastMissingSecretLogAt = 0
}

/**
 * The visitor's session token, or null when there is none, no secret to read it with, or it cannot be read. Never throws.
 *
 * With NO secret every visitor — admins and suppliers included — is anonymous here. That used to be silent beyond one line at module
 * load (a line that scrolls away on a long-lived instance); it is now an ERROR repeated at most once a minute per instance for as long
 * as requests keep arriving without a usable secret (finalisation master J3). Variable names only.
 */
export async function readProxySessionToken(
  req: NextRequest,
  secret: string | null,
  secureCookie: boolean
): Promise<ProxySessionToken> {
  if (!secret) {
    const now = Date.now()
    if (now - lastMissingSecretLogAt >= UNREADABLE_LOG_EVERY_MS) {
      lastMissingSecretLogAt = now
      console.error("[proxy]", {
        result: "auth_secret_missing_on_request",
        variables: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
        note: "No session secret is set: every visitor is treated as anonymous and no session can be read. Set AUTH_SECRET (or NEXTAUTH_SECRET) on this environment.",
      })
    }
    return null
  }
  try {
    return await getToken({ req, secret, secureCookie })
  } catch (error) {
    const now = Date.now()
    if (now - lastUnreadableLogAt >= UNREADABLE_LOG_EVERY_MS) {
      lastUnreadableLogAt = now
      console.warn("[proxy]", {
        result: "session_token_unreadable",
        error: error instanceof Error ? error.name : "unknown",
      })
    }
    return null
  }
}
