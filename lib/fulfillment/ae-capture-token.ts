import crypto from "crypto"

const TTL_SEC = 15 * 60

function readSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "affisell-dev-ae-capture"
  )
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
export function buildAeCaptureWindowName(sessionId: string, captureToken: string): string {
  return `affisellAfc|${sessionId}|${captureToken}`
}

export function parseAeCaptureWindowName(name: string): {
  sessionId: string
  captureToken: string
} | null {
  const m = name.match(/^affisellAfc\|([^|]+)\|(.+)$/)
  if (!m?.[1] || !m[2]) return null
  return { sessionId: m[1], captureToken: m[2] }
}
