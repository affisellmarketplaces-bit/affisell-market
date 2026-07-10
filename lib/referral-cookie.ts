import { cookies } from "next/headers"

import { MERCHANT_COOKIE_OPTS } from "@/lib/oauth-cookies"
import { REFERRAL_COOKIE_NAME } from "@/lib/referral-shared"

const MAX_AGE_SEC = 60 * 60 * 24 * 30

export async function consumeReferralCodeCookie(): Promise<string | null> {
  try {
    const jar = await cookies()
    const raw = jar.get(REFERRAL_COOKIE_NAME)?.value?.trim()
    if (raw) jar.delete(REFERRAL_COOKIE_NAME)
    return raw || null
  } catch {
    return null
  }
}

export async function setReferralCodeCookie(code: string): Promise<boolean> {
  const trimmed = code.trim()
  if (!trimmed) return false
  try {
    const jar = await cookies()
    jar.set(REFERRAL_COOKIE_NAME, trimmed, {
      ...MERCHANT_COOKIE_OPTS,
      maxAge: MAX_AGE_SEC,
    })
    return true
  } catch {
    return false
  }
}
