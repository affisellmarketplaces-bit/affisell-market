"use client"

import { useSyncExternalStore } from "react"

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
 */
export function useAppLocale(): AppLocale {
  return useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getServerLocaleSnapshot)
}
