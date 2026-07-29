"use client"

import { useEffect, useState } from "react"

import {
  COOKIE_CONSENT_CHANGED_EVENT,
  readCookieConsentPrefsFromDocument,
} from "@/lib/legal/cookie-consent-runtime"

/** Gate Vercel Analytics / PostHog sur consentement analytics. */
export function useAnalyticsConsent(): boolean {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const read = () => setAllowed(readCookieConsentPrefsFromDocument()?.analytics === true)
    read()
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, read)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, read)
  }, [])

  return allowed
}
