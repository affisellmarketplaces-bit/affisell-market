import type { NextResponse } from "next/server"

import { currentTermsVersionForRole } from "@/lib/legal-versions"
import type { MerchantRole } from "@/lib/legal/consent"

export const TERMS_OK_COOKIE = "affisell_terms_ok"

const ONE_YEAR_SEC = 60 * 60 * 24 * 365

/** Cookie httpOnly pour middleware (re-consent sans accès Prisma en edge). */
export function setTermsOkCookie(res: NextResponse, role: MerchantRole): void {
  const version = currentTermsVersionForRole(role)
  if (!version) return
  res.cookies.set(TERMS_OK_COOKIE, version, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SEC,
  })
}
