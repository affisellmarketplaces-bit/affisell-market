import crypto from "crypto"

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
