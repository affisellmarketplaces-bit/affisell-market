import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"

type TikTokSignatureHeader = {
  t: string
  v1: string
}

function parseSignatureHeader(header: string): TikTokSignatureHeader | null {
  const parts = header
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  const out: Record<string, string> = {}
  for (const p of parts) {
    const i = p.indexOf("=")
    if (i <= 0) continue
    out[p.slice(0, i)] = p.slice(i + 1)
  }
  if (!out.t || !out.v1) return null
  return { t: out.t, v1: out.v1 }
}

function normalizeEpochSeconds(input: string): number | null {
  const n = Number(input)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n > 10_000_000_000) return Math.floor(n / 1000)
  return Math.floor(n)
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex")
  const b = Buffer.from(bHex, "hex")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * TikTok Shop webhook signature:
 * Header `X-TT-Signature: t=timestamp,v1=hash`
 * Message: `${timestamp}.${rawBody}` — HMAC-SHA256(TIKTOK_CLIENT_SECRET)
 */
export function verifyTikTokWebhookSignature(rawBody: string, signatureHeader: string | null): void {
  if (!signatureHeader) throw new Error("Missing X-TT-Signature header")

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) throw new Error("Invalid X-TT-Signature format")

  const timestamp = normalizeEpochSeconds(parsed.t)
  if (!timestamp) throw new Error("Invalid signature timestamp")

  const nowSec = Math.floor(Date.now() / 1000)
  const drift = Math.abs(nowSec - timestamp)
  if (drift > 5 * 60) throw new Error("Signature timestamp drift too large")

  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim()
  if (!secret) throw new Error("Server misconfigured (TIKTOK_CLIENT_SECRET)")

  const msg = `${timestamp}.${rawBody}`
  const expected = createHmac("sha256", secret).update(msg, "utf8").digest("hex")

  if (!safeEqualHex(expected, parsed.v1)) {
    throw new Error("Invalid webhook signature")
  }
}

export function extractWebhookExternalId(rawBody: string, payload: Record<string, unknown>): string {
  const fromPayload = payload.event_id ?? payload.id ?? payload.msg_id
  if (typeof fromPayload === "string" && fromPayload.trim()) return fromPayload.trim()
  if (typeof fromPayload === "number" && Number.isFinite(fromPayload)) {
    return String(fromPayload)
  }
  return createHash("sha256").update(rawBody, "utf8").digest("hex")
}
