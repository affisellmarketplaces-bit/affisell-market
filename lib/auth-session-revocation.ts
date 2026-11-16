import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Session revocation for the JWT strategy, WITHOUT a schema change.
 *
 * Auth.js keeps the whole session in a signed cookie (30 days). Before this module, the `jwt` callback returned the
 * token untouched once it had a role, so a session stayed valid for 30 days after a password reset, an account
 * deletion or a role change. Now:
 *
 * - at sign-in the token carries `cfp`, a keyed fingerprint of the account's password hash (HMAC of the bcrypt hash
 *   with the auth secret, truncated — the hash itself never enters the cookie);
 * - every `SESSION_RECHECK_MS` the callback re-reads the user row: a missing user, or a fingerprint that no longer
 *   matches (the password was changed or reset), ends the session (`null` → Auth.js clears the cookie);
 * - the role and profile fields are refreshed at that moment too, so a demoted account loses its role within minutes.
 *
 * A token minted before this module has no `cfp`: it ADOPTS the current fingerprint at its first check (no mass
 * sign-out at deploy; a password reset done before the deploy does not revoke those older sessions).
 */
export const SESSION_RECHECK_MS = 5 * 60 * 1000

/** Fingerprint value for an account with no password (OAuth only, guest buyer). */
export const NO_PASSWORD_FINGERPRINT = "none"

export function credentialFingerprint(passwordHash: string | null | undefined, secret: string | undefined): string {
  if (!passwordHash) return NO_PASSWORD_FINGERPRINT
  const key = secret?.trim() || "affisell-session-fingerprint"
  return createHmac("sha256", key).update(`cfp:v1:${passwordHash}`, "utf8").digest("base64url").slice(0, 22)
}

export function fingerprintsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export type JwtRefreshDecision = "sign_in" | "update" | "recheck" | "keep"

/** What the `jwt` callback must do for this call. Pure. */
export function decideJwtRefresh(args: {
  signingIn: boolean
  trigger: string | undefined
  tokenHasRole: boolean
  checkedAt: unknown
  now: number
}): JwtRefreshDecision {
  if (args.signingIn) return "sign_in"
  if (args.trigger === "update") return "update"
  if (!args.tokenHasRole) return "recheck"
  const at = typeof args.checkedAt === "number" && Number.isFinite(args.checkedAt) ? args.checkedAt : 0
  // A clock that went backwards (or a forged future value) is treated as "never checked".
  if (at > args.now || args.now - at >= SESSION_RECHECK_MS) return "recheck"
  return "keep"
}

export type SessionValidity = { valid: true; fingerprint: string } | { valid: false; reason: "user_missing" | "credentials_changed" }

/** Is the session still valid against the user row just read? Pure. */
export function evaluateSessionValidity(args: {
  userExists: boolean
  tokenFingerprint: unknown
  currentFingerprint: string
}): SessionValidity {
  if (!args.userExists) return { valid: false, reason: "user_missing" }
  if (typeof args.tokenFingerprint !== "string" || args.tokenFingerprint.length === 0) {
    return { valid: true, fingerprint: args.currentFingerprint }
  }
  if (!fingerprintsMatch(args.tokenFingerprint, args.currentFingerprint)) {
    return { valid: false, reason: "credentials_changed" }
  }
  return { valid: true, fingerprint: args.currentFingerprint }
}
