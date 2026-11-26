/**
 * Medusa admin credentials for the local helper scripts (setup:auto, user:create, validate-tryon-sync).
 *
 * The admin e-mail and password used to be written in these scripts — and the repository is public — so they are
 * read from the environment ONLY (medusa-backend/.env, loaded by with-env.mjs, or the shell):
 *   MEDUSA_ADMIN_EMAIL     an e-mail address
 *   MEDUSA_ADMIN_PASSWORD  ≥ 16 characters, not a known-compromised value
 *
 * Every failure names the VARIABLE, never its value. Nothing here prints, logs or returns the password in a message.
 */
import { createHash } from "node:crypto"

import { COMPROMISED_SHA256 } from "../../../scripts/lib/compromised-credentials.mjs"

export const MIN_ADMIN_PASSWORD_LENGTH = 16

/** Published credentials (scripts/lib/compromised-credentials.mjs at the repository root): refused here too. */
export const COMPROMISED_PASSWORD_SHA256 = COMPROMISED_SHA256

export function sha256Hex(value) {
  return createHash("sha256").update(String(value)).digest("hex")
}

export function isCompromisedPassword(value) {
  return COMPROMISED_PASSWORD_SHA256.has(sha256Hex(value))
}

export class AdminCredentialsError extends Error {
  constructor(code, message) {
    super(message)
    this.name = "AdminCredentialsError"
    this.code = code
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Reads and validates the admin credentials. Throws AdminCredentialsError (code + message naming the variable only).
 * @param {Record<string, string | undefined>} env
 * @returns {{ email: string, password: string }}
 */
export function readAdminCredentials(env = process.env) {
  const email = (env.MEDUSA_ADMIN_EMAIL ?? "").trim()
  const password = env.MEDUSA_ADMIN_PASSWORD ?? ""
  if (!email) throw new AdminCredentialsError("email_missing", "MEDUSA_ADMIN_EMAIL is not set (medusa-backend/.env)")
  if (!EMAIL_RE.test(email)) throw new AdminCredentialsError("email_invalid", "MEDUSA_ADMIN_EMAIL is not an e-mail address")
  if (!password) {
    throw new AdminCredentialsError("password_missing", "MEDUSA_ADMIN_PASSWORD is not set (medusa-backend/.env)")
  }
  if (password !== password.trim()) {
    throw new AdminCredentialsError("password_whitespace", "MEDUSA_ADMIN_PASSWORD starts or ends with whitespace")
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new AdminCredentialsError(
      "password_too_short",
      `MEDUSA_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`
    )
  }
  if (isCompromisedPassword(password)) {
    throw new AdminCredentialsError(
      "password_compromised",
      "MEDUSA_ADMIN_PASSWORD is a published (compromised) value — choose a new one"
    )
  }
  return { email, password }
}

/** For CLI scripts: returns the credentials or prints the reason (never the value) and exits 1. */
export function requireAdminCredentials(tool, env = process.env) {
  try {
    return readAdminCredentials(env)
  } catch (err) {
    if (err instanceof AdminCredentialsError) {
      console.error(`[${tool}] ${err.message}`)
      process.exit(1)
    }
    throw err
  }
}
