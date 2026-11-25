import { signingSecret } from "@/lib/security/app-secret"
import crypto from "crypto"

const TTL_SEC = 15 * 60

function readSecret(): string {
  // Fails closed outside development / test: the literal is public (lib/security/app-secret.ts).
  return signingSecret("AliExpress capture tokens", ["AUTH_SECRET", "NEXTAUTH_SECRET"], "affisell-dev-ae-capture")
}

/** HMAC token so bookmarklet can POST from aliexpress.com without session cookies. */
export function createAeCaptureToken(sessionId: string, productId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC
  const mac = crypto
    .createHmac("sha256", readSecret())
    .update(`${sessionId}|${productId}|${exp}`)
    .digest("base64url")
  return `${exp}.${mac}`
}

export function verifyAeCaptureToken(
  token: string,
  sessionId: string,
  productId: string
): boolean {
  const dot = token.indexOf(".")
  if (dot <= 0) return false
  const expStr = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false

  const expected = crypto
    .createHmac("sha256", readSecret())
    .update(`${sessionId}|${productId}|${exp}`)
    .digest("base64url")

  try {
    const a = Buffer.from(mac)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Persisted on `window.name` when opening AliExpress (survives hash stripping). */
export function buildAeCaptureWindowName(
  productId: string,
  sessionId: string,
  captureToken: string
): string {
  return `affisellAfc|${productId}|${sessionId}|${captureToken}`
}

export function parseAeCaptureWindowName(name: string): {
  productId?: string
  sessionId: string
  captureToken: string
} | null {
  const m4 = name.match(/^affisellAfc\|([^|]+)\|([^|]+)\|(.+)$/)
  if (m4?.[1] && m4[2] && m4[3]) {
    return { productId: m4[1], sessionId: m4[2], captureToken: m4[3] }
  }
  const m2 = name.match(/^affisellAfc\|([^|]+)\|(.+)$/)
  if (m2?.[1] && m2[2]) {
    return { sessionId: m2[1], captureToken: m2[2] }
  }
  return null
}
