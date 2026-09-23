"use client"

import { useEffect, useSyncExternalStore } from "react"

import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n-locale"
import { readLocaleFromDocumentCookie } from "@/lib/i18n-read-locale-cookie"

/** Dispatched when `affisell_locale` changes without a full navigation (rare). */
export const APP_LOCALE_CHANGED_EVENT = "affisell:locale-changed"

export function notifyAppLocaleChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APP_LOCALE_CHANGED_EVENT))
  }
}

function subscribeLocale(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(APP_LOCALE_CHANGED_EVENT, onStoreChange)
  return () => window.removeEventListener(APP_LOCALE_CHANGED_EVENT, onStoreChange)
}

function getLocaleSnapshot(): AppLocale {
  return readLocaleFromDocumentCookie()
}

function getServerLocaleSnapshot(): AppLocale {
  return DEFAULT_LOCALE
}

/**
 * Client locale for deferred shells (Dona FAB) that may mount outside `NextIntlClientProvider`.
 * Reads `affisell_locale` cookie — same source of truth as server `bootstrapRootShell`.
 *
 * `getServerLocaleSnapshot` can't know the real per-request locale (no access to the
 * request cookie from a plain client hook), so it always reports `DEFAULT_LOCALE` for the
 * hydration-matching pass. If the real cookie differs, `useSyncExternalStore` won't pick that
 * up on its own until *something* re-renders this component — which may never happen for a
 * mostly-static shell like the Dona widgets. The mount effect below forces one resync so the
 * real locale is read within a tick of hydration instead of staying stuck at the default.
 */
export function useAppLocale(): AppLocale {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getServerLocaleSnapshot)

  useEffect(() => {
    notifyAppLocaleChanged()
  }, [])

  return locale
}
