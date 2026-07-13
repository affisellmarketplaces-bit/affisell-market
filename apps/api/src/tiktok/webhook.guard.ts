import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { createHmac, timingSafeEqual } from "node:crypto"

type TikTokSignatureHeader = {
  t: string
  v1: string
}

function parseSignatureHeader(header: string): TikTokSignatureHeader | null {
  // Example: "t=1720000000,v1=abcdef..."
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
  // Some platforms send ms; TikTok header is seconds, but be tolerant.
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
 * TikTok Shop official signature verification:
 * - Header: `X-TT-Signature: t=timestamp,v1=hash`
 * - Message: `${timestamp}.${rawBody}`
 * - Algo: HMAC-SHA256 with `TIKTOK_CLIENT_SECRET`
 * - Reject if timestamp is older/newer than 5 minutes
 */
@Injectable()
export class TikTokWebhookGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      rawBody?: string
    }>()

    const signatureHeader = req.headers["x-tt-signature"]
    const headerValue =
      typeof signatureHeader === "string"
        ? signatureHeader
        : Array.isArray(signatureHeader)
          ? signatureHeader[0]
          : undefined

    if (!headerValue) throw new UnauthorizedException("Missing X-TT-Signature header")

    const parsed = parseSignatureHeader(headerValue)
    if (!parsed) throw new UnauthorizedException("Invalid X-TT-Signature format")

    const timestamp = normalizeEpochSeconds(parsed.t)
    if (!timestamp) throw new UnauthorizedException("Invalid signature timestamp")

    const nowSec = Math.floor(Date.now() / 1000)
    const drift = Math.abs(nowSec - timestamp)
    if (drift > 5 * 60) throw new UnauthorizedException("Signature timestamp drift too large")

    const rawBody = req.rawBody ?? ""
    const secret = process.env.TIKTOK_CLIENT_SECRET
    if (!secret) throw new UnauthorizedException("Server misconfigured (TIKTOK_CLIENT_SECRET)")

    const msg = `${timestamp}.${rawBody}`
    const expected = createHmac("sha256", secret).update(msg, "utf8").digest("hex")

    if (!safeEqualHex(expected, parsed.v1)) {
      throw new UnauthorizedException("Invalid webhook signature")
    }

    return true
  }
}

