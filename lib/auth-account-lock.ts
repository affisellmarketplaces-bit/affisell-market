/**
 * Account lock by password prefix (security operation of 2026-11-25, docs/MEDUSA-CREDENTIALS-REMEDIATION.md §7).
 *
 * A compromised account is neutralised — reversibly, without deleting profiles or legal acceptances — by prefixing its
 * stored bcrypt hash with `locked-<date>:`. Removing the prefix restores it exactly. Pure module: no Prisma.
 */
export const ACCOUNT_LOCK_PREFIX = "locked-"

/** True when the stored password hash carries the lock prefix (the hash itself is never logged or returned). */
export function isPasswordLocked(storedHash: string | null | undefined): boolean {
  return typeof storedHash === "string" && storedHash.startsWith(ACCOUNT_LOCK_PREFIX)
}

/**
 * How often a signed-in session re-checks its account (deleted, locked, role changed). JWT sessions live 30 days and
 * can not be revoked one by one; this bounds how long a neutralised account keeps a session open.
 */
export const SESSION_REVALIDATE_MS = 5 * 60 * 1000

export type SessionRevalidation =
  | { action: "keep" }
  | { action: "check" }

/** Whether the jwt callback must re-read the account now. `checkedAt` is the token's last check (epoch ms). */
export function sessionRevalidationDue(checkedAt: unknown, now: number): SessionRevalidation {
  if (typeof checkedAt !== "number" || !Number.isFinite(checkedAt)) return { action: "check" }
  if (checkedAt > now + 60_000) return { action: "check" } // clock skew or forged value: re-check
  return now - checkedAt >= SESSION_REVALIDATE_MS ? { action: "check" } : { action: "keep" }
}

export type AccountStatus = { exists: false } | { exists: true; locked: boolean; role: string }

/** Decision after the re-read: end the session (null) or keep it, with the current role. */
export function sessionAfterCheck(status: AccountStatus): { end: true } | { end: false; role: string } {
  if (!status.exists || status.locked) return { end: true }
  return { end: false, role: status.role }
}
