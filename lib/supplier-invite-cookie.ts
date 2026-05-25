import { cookies } from "next/headers"

import {
  MERCHANT_COOKIE_OPTS,
  SUPPLIER_INVITE_TOKEN_COOKIE,
} from "@/lib/oauth-cookies"
import { normalizeSupplierInviteToken } from "@/lib/supplier-invitation-token"

const MAX_AGE_SEC = 60 * 60 * 24 * 14

export async function setSupplierInviteTokenCookie(tokenRaw: string): Promise<boolean> {
  const token = normalizeSupplierInviteToken(tokenRaw)
  if (!token) return false
  try {
    const jar = await cookies()
    jar.set(SUPPLIER_INVITE_TOKEN_COOKIE, token, {
      ...MERCHANT_COOKIE_OPTS,
      maxAge: MAX_AGE_SEC,
    })
    return true
  } catch {
    return false
  }
}

/** Read and clear — call once after supplier account is created. */
export async function consumeSupplierInviteTokenCookie(): Promise<string | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(SUPPLIER_INVITE_TOKEN_COOKIE)?.value
    jar.delete(SUPPLIER_INVITE_TOKEN_COOKIE)
    const token = raw ? normalizeSupplierInviteToken(raw) ?? raw.trim().toUpperCase() : null
    return token || null
  } catch {
    return null
  }
}
