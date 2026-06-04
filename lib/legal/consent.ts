import { CGU_VERSION } from "@/lib/legal/cgu"
import { LEGAL_DOC_VERSION } from "@/lib/legal/entity"

export type MerchantRole = "SUPPLIER" | "AFFILIATE" | "CUSTOMER"

export function termsSlugForRole(role: MerchantRole): string {
  if (role === "SUPPLIER") return "terms-supplier"
  if (role === "AFFILIATE") return "terms-affiliate"
  return "terms-of-service"
}

export function termsLabelForRole(role: MerchantRole): string {
  if (role === "SUPPLIER") return "CGU et CGS"
  if (role === "AFFILIATE") return "CGU et CGA"
  return "CGU"
}

export function buildConsentPayload(role: MerchantRole) {
  const now = new Date()
  return {
    cguAcceptedAt: now,
    cguVersion: CGU_VERSION,
    privacyAcceptedAt: now,
    privacyAcceptedVersion: `${LEGAL_DOC_VERSION}:privacy-policy`,
    ...(role !== "CUSTOMER"
      ? {
          termsAcceptedAt: now,
          termsAcceptedVersion: `${LEGAL_DOC_VERSION}:${termsSlugForRole(role)}`,
        }
      : {}),
  }
}

export function buildCguOnlyPayload() {
  const now = new Date()
  return {
    cguAcceptedAt: now,
    cguVersion: CGU_VERSION,
  }
}

export type CookieConsentPrefs = {
  essential: true
  analytics: boolean
  marketing: boolean
  updatedAt: string
}

export function parseCookieConsent(raw: unknown): CookieConsentPrefs | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  return {
    essential: true,
    analytics: Boolean(o.analytics),
    marketing: Boolean(o.marketing),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  }
}

export const COOKIE_CONSENT_COOKIE = "affisell_cookie_consent"
