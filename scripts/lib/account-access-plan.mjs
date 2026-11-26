/**
 * Pure planning for scripts/account-access.ts (create a nominative admin, lock / unlock accounts reversibly).
 * Every rule fails closed and names accounts by e-mail only — never a hash, a password or a token.
 */
import { createHash } from "node:crypto"

import { COMPROMISED_SHA256 } from "./compromised-credentials.mjs"

export const LOCK_PREFIX = "locked-"
export const MIN_ADMIN_PASSWORD_LENGTH = 16
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function lockTag(date = new Date()) {
  return `${LOCK_PREFIX}${date.toISOString().slice(0, 10)}:`
}

/** @returns {string | null} a reason, or null when the password is acceptable for an admin */
export function adminPasswordProblem(password) {
  if (typeof password !== "string" || password.length === 0) return "password_missing"
  if (password !== password.trim()) return "password_whitespace"
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) return "password_too_short"
  if (COMPROMISED_SHA256.has(createHash("sha256").update(password).digest("hex"))) return "password_compromised"
  return null
}

/**
 * @param {{ email: string, existing: { email: string } | null }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function planCreateAdmin({ email, existing }) {
  if (!EMAIL_RE.test(email ?? "")) return { ok: false, reason: "email_invalid" }
  if (existing) return { ok: false, reason: "email_already_exists" }
  return { ok: true }
}

/**
 * @param {{
 *   emails: string[],
 *   expect: number,
 *   rows: Array<{ email: string, role: string, hasPassword: boolean, locked: boolean }>,
 *   unlockedAdminsTotal: number,
 * }} input  rows = the accounts named, as read from the database
 * @returns {{ ok: true, targets: string[] } | { ok: false, reason: string, detail?: string[] }}
 */
export function planLock({ emails, expect, rows, unlockedAdminsTotal }) {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (wanted.length === 0) return { ok: false, reason: "no_email" }
  if (wanted.length !== expect) return { ok: false, reason: "expect_mismatch", detail: [`${wanted.length} named, ${expect} expected`] }
  const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r]))
  const missing = wanted.filter((e) => !byEmail.has(e))
  if (missing.length) return { ok: false, reason: "account_missing", detail: missing }
  const noPassword = wanted.filter((e) => !byEmail.get(e).hasPassword)
  if (noPassword.length) return { ok: false, reason: "no_password_to_lock", detail: noPassword }
  const already = wanted.filter((e) => byEmail.get(e).locked)
  if (already.length) return { ok: false, reason: "already_locked", detail: already }
  const adminsLocked = wanted.filter((e) => byEmail.get(e).role === "ADMIN").length
  if (adminsLocked > 0 && unlockedAdminsTotal - adminsLocked < 1) {
    return { ok: false, reason: "would_lock_out_last_admin" }
  }
  return { ok: true, targets: wanted }
}

/**
 * @param {{ emails: string[], expect: number, rows: Array<{ email: string, locked: boolean }> }} input
 */
export function planUnlock({ emails, expect, rows }) {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (wanted.length !== expect) return { ok: false, reason: "expect_mismatch" }
  const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r]))
  const notLocked = wanted.filter((e) => !byEmail.get(e)?.locked)
  if (notLocked.length) return { ok: false, reason: "not_locked", detail: notLocked }
  return { ok: true, targets: wanted }
}
