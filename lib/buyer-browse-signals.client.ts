"use client"

import {
  BUYER_BROWSE_SIGNALS_COOKIE,
  BUYER_BROWSE_SIGNALS_MAX,
  mergeBrowseSignalCategories,
  parseBrowseSignalsCookie,
} from "@/lib/buyer-browse-signals-shared"

const MAX_AGE_SEC = 60 * 60 * 24 * 90

function readBrowseSignalsFromDocument(): string[] {
  if (typeof document === "undefined") return []
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${BUYER_BROWSE_SIGNALS_COOKIE}=`))
  if (!match) return []
  const raw = decodeURIComponent(match.slice(BUYER_BROWSE_SIGNALS_COOKIE.length + 1))
  return parseBrowseSignalsCookie(raw)
}

/** Persist department browse for cross-session recommendations (idempotent merge). */
export function recordBrowseSignalCategory(categoryName: string): void {
  if (typeof document === "undefined") return
  const name = categoryName.trim()
  if (!name) return

  const merged = mergeBrowseSignalCategories(readBrowseSignalsFromDocument(), name)
  const value = encodeURIComponent(JSON.stringify(merged))
  document.cookie = `${BUYER_BROWSE_SIGNALS_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`
}

export function clearBrowseSignalCategories(): void {
  if (typeof document === "undefined") return
  document.cookie = `${BUYER_BROWSE_SIGNALS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export { BUYER_BROWSE_SIGNALS_MAX }
