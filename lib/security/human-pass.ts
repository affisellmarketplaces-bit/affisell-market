import { createHmac, timingSafeEqual } from "node:crypto"

export const HUMAN_PASS_COOKIE = "affisell_human_pass"
const PURPOSE = "humanoid-shield-pass"
const TTL_MS = 24 * 60 * 60 * 1000

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  if (!s) throw new Error("AUTH_SECRET is required for human pass tokens")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function createHumanPassToken(ip: string): string {
  const exp = Date.now() + TTL_MS
  const body = `${PURPOSE}:${ip.trim()}:${exp}`
  return `${body}:${sign(body)}`
}

export function verifyHumanPassToken(token: string, ip: string): boolean {
  const parts = token.split(":")
  if (parts.length !== 4) return false
  const [purpose, tokenIp, expRaw, sig] = parts
  if (purpose !== PURPOSE || !tokenIp?.trim() || !sig) return false
  if (tokenIp.trim() !== ip.trim()) return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || Date.now() > exp) return false
  const body = `${purpose}:${tokenIp}:${expRaw}`
  const expected = sign(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function humanPassCookieMaxAgeSec(): number {
  return Math.floor(TTL_MS / 1000)
}

/** Same-origin relative paths only — blocks open redirects. */
export function sanitizeShieldReturnTo(raw: string | null | undefined): string {
  const fallback = "/"
  if (!raw?.trim()) return fallback
  const value = raw.trim()
  if (!value.startsWith("/") || value.startsWith("//")) return fallback
  if (value.includes("\\") || /[\u0000-\u001F]/.test(value)) return fallback
  try {
    const url = new URL(value, "https://affisell.com")
    if (url.pathname === "/shield-blocked") return fallback
    return `${url.pathname}${url.search}`.slice(0, 512) || fallback
  } catch {
    return fallback
  }
}
