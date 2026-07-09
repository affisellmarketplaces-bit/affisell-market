import type { NextRequest } from "next/server"
import type { JWT } from "next-auth/jwt"

import { getRequiredDocumentSlugs } from "@/lib/legal/required-documents"
import { LEGAL_OK_COOKIE, legalGateCookieMatches } from "@/lib/legal/legal-gate-cookie"
import { isLegalGateV2EnabledSync } from "@/lib/legal/feature-flags"
import { TERMS_OK_COOKIE } from "@/lib/legal/terms-acceptance-cookie"
import {
  CURRENT_TERMS_VERSION,
  isRoleTermsVersionCurrent,
} from "@/lib/legal-versions"

const REACCEPT_PATH = "/reaccept-terms"

const EXEMPT_PATHS = [
  REACCEPT_PATH,
  "/supplier/onboarding",
  "/affiliate/onboarding",
  "/login",
  "/signup",
  "/sign-up",
  "/cgu",
  "/cgv",
  "/conditions-fournisseur",
  "/conditions-affilie",
  "/privacy",
  "/contact",
  "/legal",
  "/api/legal",
] as const

export function getRequiredDocuments(role: string): string[] {
  return getRequiredDocumentSlugs(role)
}

export function isReacceptTermsPath(bare: string): boolean {
  return bare === REACCEPT_PATH || bare.startsWith(`${REACCEPT_PATH}/`)
}

export function isLegalGateExemptPath(bare: string): boolean {
  if (EXEMPT_PATHS.some((p) => bare === p || bare.startsWith(`${p}/`))) return true
  if (bare.startsWith("/login/")) return true
  if (bare.startsWith("/signup/")) return true
  return false
}

/** @deprecated Use isLegalGateExemptPath */
export function isMerchantTermsExemptPath(bare: string): boolean {
  return isLegalGateExemptPath(bare)
}

export function isLegalGatedPath(bare: string): boolean {
  if (bare === "/dashboard" || bare.startsWith("/dashboard/")) return true
  if (bare === "/marketplace/account" || bare.startsWith("/marketplace/account/")) return true
  if (bare.startsWith("/supplier/") && bare !== "/supplier/onboarding") return true
  if (bare.startsWith("/affiliate/") && !bare.startsWith("/affiliate/onboarding")) return true
  return false
}

/** @deprecated Use isLegalGatedPath */
export function isMerchantTermsGatedPath(bare: string): boolean {
  return (
    bare === "/dashboard/supplier" ||
    bare.startsWith("/dashboard/supplier/") ||
    bare === "/dashboard/affiliate" ||
    bare.startsWith("/dashboard/affiliate/") ||
    (bare.startsWith("/supplier/") && bare !== "/supplier/onboarding") ||
    (bare.startsWith("/affiliate/") && !bare.startsWith("/affiliate/onboarding"))
  )
}

export function legalGateCookieOk(req: NextRequest, token: JWT | null): boolean {
  const cookie = req.cookies.get(LEGAL_OK_COOKIE)?.value
  const expected =
    typeof token?.legalGateHash === "string" ? token.legalGateHash : null
  return legalGateCookieMatches(cookie, expected)
}

export function merchantTermsGateOk(
  req: NextRequest,
  role: string | undefined,
  token: JWT | null
): boolean {
  if (role !== "SUPPLIER" && role !== "AFFILIATE") return true

  const expected = CURRENT_TERMS_VERSION[role]
  const cookie = req.cookies.get(TERMS_OK_COOKIE)?.value
  if (cookie === expected) return true

  const jwtVersion =
    typeof token?.termsAcceptedVersion === "string" ? token.termsAcceptedVersion : null
  return isRoleTermsVersionCurrent(role, jwtVersion)
}

/** Edge-safe gate — cookie/JWT only when V2; legacy merchant gate when V1. */
export function legalGateOk(
  req: NextRequest,
  role: string | undefined,
  token: JWT | null
): boolean {
  if (!isLegalGateV2EnabledSync()) {
    return merchantTermsGateOk(req, role, token)
  }
  return legalGateCookieOk(req, token)
}

export function reacceptTermsUrl(req: NextRequest, returnPath: string, doc?: string): URL {
  const u = new URL(REACCEPT_PATH, req.url)
  u.searchParams.set("returnTo", returnPath)
  if (doc) u.searchParams.set("doc", doc)
  return u
}
