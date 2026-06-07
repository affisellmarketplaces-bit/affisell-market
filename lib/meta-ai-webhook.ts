import crypto from "crypto"

import { webhookSecretGate } from "@/lib/require-production-secret"

/** HMAC-SHA256 signature for Meta AI webhook callbacks. */
export function signMetaWebhookPayload(rawBody: string, secret: string): string {
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  return `sha256=${digest}`
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader?.trim() || !secret) return false
  const expected = signMetaWebhookPayload(rawBody, secret)
  const a = Buffer.from(signatureHeader.trim())
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Meta AI webhook auth: fail-closed in production when META_WEBHOOK_SECRET is unset.
 * @returns `missing_prod` | `unauthorized` | `ok`
 */
export function authorizeMetaWebhookRequest(
  rawBody: string,
  signatureHeader: string | null
): "missing_prod" | "unauthorized" | "ok" {
  const secret = process.env.META_WEBHOOK_SECRET?.trim()
  const gate = webhookSecretGate(secret)
  if (gate === "missing_prod") return "missing_prod"
  if (gate === "missing_sig") return "ok"
  if (!secret || !verifyMetaWebhookSignature(rawBody, signatureHeader, secret)) {
    return "unauthorized"
  }
  return "ok"
}
