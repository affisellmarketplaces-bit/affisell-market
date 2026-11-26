import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Verifies a Replicate webhook (Standard Webhooks scheme) — finalisation master doc, C4.
 *
 * Headers: `webhook-id`, `webhook-timestamp` (seconds), `webhook-signature` (space-separated `v1,<base64>` entries).
 * Signed content: `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the base64-decoded signing secret (`whsec_…`).
 * The previous route only checked that SOME header was present, so anyone could forge a "succeeded" prediction.
 */

const TOLERANCE_MS = 5 * 60 * 1000

export type ReplicateWebhookCheck = {
  secret: string
  id: string | null
  timestamp: string | null
  signature: string | null
  /** The RAW request body (must be read with `req.text()` before any JSON parsing). */
  body: string
  /** Injectable clock for tests. */
  nowMs?: number
}

export function verifyReplicateWebhook(check: ReplicateWebhookCheck): boolean {
  const { secret, id, timestamp, signature, body } = check
  if (!secret || !id || !timestamp || !signature) return false

  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds)) return false
  const now = check.nowMs ?? Date.now()
  if (Math.abs(now - seconds * 1000) > TOLERANCE_MS) return false

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64")
  if (key.length === 0) return false

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest()

  for (const entry of signature.split(" ")) {
    const comma = entry.indexOf(",")
    if (comma < 0 || entry.slice(0, comma) !== "v1") continue
    const candidate = Buffer.from(entry.slice(comma + 1), "base64")
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true
  }
  return false
}
