import "server-only"

import { randomUUID } from "node:crypto"

import { TRYON_ANON_COOKIE } from "@/lib/try-on/try-on-shared"

export function readTryOnAnonId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=")
    if (rawKey === TRYON_ANON_COOKIE) {
      const value = rest.join("=").trim()
      return value.length > 0 ? decodeURIComponent(value) : null
    }
  }
  return null
}

export function ensureTryOnAnonId(existing: string | null): string {
  return existing?.trim() || randomUUID()
}

export function tryOnAnonSetCookieHeader(anonId: string): string {
  const maxAge = 60 * 60 * 24 * 365
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${TRYON_ANON_COOKIE}=${encodeURIComponent(anonId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}
