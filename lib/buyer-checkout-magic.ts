import { createHmac, timingSafeEqual } from "crypto"

const PURPOSE = "buyer-checkout"
const TTL_MS = 10 * 60 * 1000

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!s) throw new Error("AUTH_SECRET is required for checkout magic tokens")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

/** Short-lived token so the client can open a session without a password. */
export function createBuyerCheckoutMagicToken(userId: string): string {
  const exp = Date.now() + TTL_MS
  const body = `${PURPOSE}:${userId}:${exp}`
  return `${body}:${sign(body)}`
}

export function verifyBuyerCheckoutMagicToken(token: string): { userId: string } | null {
  const parts = token.split(":")
  if (parts.length !== 4) return null
  const [purpose, userId, expRaw, sig] = parts
  if (purpose !== PURPOSE || !userId?.trim() || !sig) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || Date.now() > exp) return null
  const body = `${purpose}:${userId}:${expRaw}`
  const expected = sign(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return { userId: userId.trim() }
}
