import { createHash } from "node:crypto"

import type { NextResponse } from "next/server"

export const LEGAL_OK_COOKIE = "affisell_legal_ok"

const ONE_HOUR_SEC = 60 * 60

export function computeLegalGateHash(versionIds: string[]): string {
  return createHash("sha256")
    .update([...versionIds].sort().join(":"))
    .digest("hex")
}

export function setLegalOkCookie(res: NextResponse, versionIds: string[]): void {
  const hash = computeLegalGateHash(versionIds)
  res.cookies.set(LEGAL_OK_COOKIE, hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_HOUR_SEC,
  })
}

export function legalGateCookieMatches(
  cookieValue: string | undefined,
  expectedHash: string | null | undefined
): boolean {
  if (!cookieValue?.trim() || !expectedHash?.trim()) return false
  return cookieValue === expectedHash
}
