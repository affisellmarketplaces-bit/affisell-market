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

function encodePart(value: string | null | undefined): string {
  if (!value?.trim()) return ""
  return Buffer.from(value.trim(), "utf8").toString("base64url")
}

function decodePart(value: string): string {
  if (!value) return ""
  try {
    return Buffer.from(value, "base64url").toString("utf8")
  } catch {
    return ""
  }
}

/** Short-lived token so the client can open a session without a password. */
export function createBuyerCheckoutMagicToken(
  userId: string,
  profile?: { email?: string; name?: string | null }
): string {
  const exp = Date.now() + TTL_MS
  const emailPart = encodePart(profile?.email)
  const namePart = encodePart(profile?.name)
  const body = `${PURPOSE}:${userId}:${exp}:${emailPart}:${namePart}`
  return `${body}:${sign(body)}`
}

export function verifyBuyerCheckoutMagicToken(token: string): {
  userId: string
  email: string
  name: string | null
} | null {
  const parts = token.split(":")
  if (parts.length !== 6) return null
  const [purpose, userId, expRaw, emailPart, namePart, sig] = parts
  if (purpose !== PURPOSE || !userId?.trim() || !sig) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || Date.now() > exp) return null
  const body = `${purpose}:${userId}:${expRaw}:${emailPart}:${namePart}`
  const expected = sign(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  const email = decodePart(emailPart ?? "")
  const nameRaw = decodePart(namePart ?? "")
  return {
    userId: userId.trim(),
    email,
    name: nameRaw || null,
  }
}
