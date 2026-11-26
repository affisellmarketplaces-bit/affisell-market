/**
 * Admin access allowlist — a second, configuration-level key on the ADMIN role.
 *
 * The ADMIN role lives in the database (`User.role`). With `ADMIN_EMAIL_ALLOWLIST` set (comma-separated e-mails),
 * an ADMIN account whose e-mail is NOT listed is treated as a CUSTOMER everywhere the session role is read: it cannot
 * use the admin sign-in portal, and an open session loses admin rights at the next revalidation (≤ 5 min,
 * lib/auth-account-lock.ts). So:
 *   - neutralising an old admin (e.g. the seed `admin@affisell.io`) is a configuration change, reversible, that
 *     writes nothing to the database;
 *   - a role escalation written into the database (SQL injection, a compromised script, a wrong UPDATE) does not
 *     grant admin access on its own.
 * Unset or empty = the database role alone decides (previous behaviour), so deploying this changes nothing until
 * the variable is set. The list never ADDS a role: an e-mail on the list without the ADMIN role stays what it is.
 */
export const ADMIN_ALLOWLIST_ENV = "ADMIN_EMAIL_ALLOWLIST"

export function parseAdminAllowlist(raw: string | undefined | null): ReadonlySet<string> | null {
  const emails = (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"))
  return emails.length > 0 ? new Set(emails) : null
}

/** The role the application should act on. Only ever lowers ADMIN to CUSTOMER; never raises anything. */
export function effectiveRole(
  role: string,
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): string {
  if (role !== "ADMIN") return role
  const allow = parseAdminAllowlist(env[ADMIN_ALLOWLIST_ENV])
  if (!allow) return role
  return email && allow.has(email.trim().toLowerCase()) ? "ADMIN" : "CUSTOMER"
}
