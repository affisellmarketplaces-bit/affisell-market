import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import { tiktokAppSecret } from "@/lib/tiktok/env"

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
  try {
    const a = Buffer.from(aHex, "hex")
    const b = Buffer.from(bHex, "hex")
    if (a.length === 0 || a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * TikTok Shop webhook signature.
 * Headers: `X-TT-Signature` or `x-tiktok-shop-signature`
 * Format: `t=timestamp,v1=hash` OR raw hex HMAC of body.
 * Message (Partner): `${timestamp}.${rawBody}` — HMAC-SHA256(app_secret)
 */
export function verifyTikTokWebhookSignature(rawBody: string, signatureHeader: string | null): void {
  if (!signatureHeader) throw new Error("Missing TikTok signature header")

  const secret = tiktokAppSecret()
  if (!secret) throw new Error("Server misconfigured (TikTok app secret)")

  const parsed = parseSignatureHeader(signatureHeader)
  if (parsed) {
    const timestamp = normalizeEpochSeconds(parsed.t)
    if (!timestamp) throw new Error("Invalid signature timestamp")

    const nowSec = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSec - timestamp) > 5 * 60) {
      throw new Error("Signature timestamp drift too large")
    }

    const msg = `${timestamp}.${rawBody}`
    const expected = createHmac("sha256", secret).update(msg, "utf8").digest("hex")
    if (!safeEqualHex(expected, parsed.v1)) {
      throw new Error("Invalid webhook signature")
    }
    return
  }

  // Raw hex body HMAC fallback
  const expectedBody = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  if (!safeEqualHex(expectedBody, signatureHeader.trim())) {
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

export function resolveTikTokSignatureHeader(req: Request): string | null {
  return (
    req.headers.get("x-tt-signature") ||
    req.headers.get("x-tiktok-shop-signature") ||
    req.headers.get("Authorization")
  )
}
