import { cookies } from "next/headers"

import {
  AFFILIATE_INVITE_TOKEN_COOKIE,
  MERCHANT_COOKIE_OPTS,
} from "@/lib/oauth-cookies"
import { normalizeSupplierAffiliateInviteToken } from "@/lib/supplier-affiliate-invitation-token"

const MAX_AGE_SEC = 60 * 60 * 24 * 14

export async function setAffiliateInviteTokenCookie(tokenRaw: string): Promise<boolean> {
  const token = normalizeSupplierAffiliateInviteToken(tokenRaw)
  if (!token) return false
  try {
    const jar = await cookies()
    jar.set(AFFILIATE_INVITE_TOKEN_COOKIE, token, {
      ...MERCHANT_COOKIE_OPTS,
      maxAge: MAX_AGE_SEC,
    })
    return true
  } catch {
    return false
  }
}

export async function consumeAffiliateInviteTokenCookie(): Promise<string | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(AFFILIATE_INVITE_TOKEN_COOKIE)?.value
    jar.delete(AFFILIATE_INVITE_TOKEN_COOKIE)
    const token = raw ? normalizeSupplierAffiliateInviteToken(raw) ?? raw.trim().toUpperCase() : null
    return token || null
  } catch {
    return null
  }
}
