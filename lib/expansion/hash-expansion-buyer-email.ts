import { createHash } from "node:crypto"

const DEFAULT_SALT = "affisell-expansion-email"

/** Pseudonymous buyer id for Metabase exports — never store raw email in ProcessedWebhook. */
export function hashExpansionBuyerEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return ""
  const salt = process.env.EXPANSION_EMAIL_HASH_SALT?.trim() || DEFAULT_SALT
  return createHash("sha256").update(`${salt}:${normalized}`).digest("hex").slice(0, 16)
}
