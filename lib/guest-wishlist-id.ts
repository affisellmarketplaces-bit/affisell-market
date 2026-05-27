import { randomUUID } from "crypto"
import { cookies } from "next/headers"

import { MERCHANT_COOKIE_OPTS } from "@/lib/oauth-cookies"

export const GUEST_WISHLIST_ID_COOKIE = "affisell_gid"

const GUEST_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/
const MAX_AGE_SEC = 60 * 60 * 24 * 400

function normalizeGuestId(raw: string | undefined): string | null {
  const v = raw?.trim()
  if (!v || !GUEST_ID_RE.test(v)) return null
  return v
}

/** Read anonymous buyer id from cookie (no create). */
export async function readGuestWishlistId(): Promise<string | null> {
  try {
    const jar = await cookies()
    return normalizeGuestId(jar.get(GUEST_WISHLIST_ID_COOKIE)?.value)
  } catch {
    return null
  }
}

/** Ensure cookie exists; returns guest id for guest wishlist rows. */
export async function getOrCreateGuestWishlistId(): Promise<string> {
  const existing = await readGuestWishlistId()
  if (existing) return existing

  const id = randomUUID()
  try {
    const jar = await cookies()
    jar.set(GUEST_WISHLIST_ID_COOKIE, id, {
      ...MERCHANT_COOKIE_OPTS,
      maxAge: MAX_AGE_SEC,
    })
  } catch {
    /* Route may be static — caller still gets id for this request */
  }
  return id
}
