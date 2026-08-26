"use client"

import { useEffect } from "react"

import { COOKIE_CONSENT_GRANTED_EVENT } from "@/lib/legal/cookie-consent-constants"
import { injectGtagConsentDefault } from "@/lib/legal/cookie-consent-gtag-bootstrap"

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()

function gtagReady(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function"
}

function loadGoogleAnalytics(): void {
  if (!GA_ID || document.getElementById("gtag-js-active")) return

  const loader = document.createElement("script")
  loader.id = "gtag-js-active"
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  loader.async = true
  document.head.appendChild(loader)

  loader.addEventListener("load", () => {
    if (!gtagReady()) return
    window.gtag!("js", new Date())
    window.gtag!("config", GA_ID, { anonymize_ip: true })
  })
}

function activateDeferredAnalyticsScripts(): void {
  loadGoogleAnalytics()
}

/**
 * React 19 safe — all scripts injected via DOM APIs (no next/script or raw <script> in tree).
 * Consent default runs synchronously on mount before any GA loader.
 */
export function CookieConsentScriptActivator() {
  useEffect(() => {
    injectGtagConsentDefault()

    const onGranted = () => activateDeferredAnalyticsScripts()
    document.addEventListener(COOKIE_CONSENT_GRANTED_EVENT, onGranted)
    if (document.cookie.includes("affisell_cookie_consent=true")) {
      activateDeferredAnalyticsScripts()
    }
    return () => document.removeEventListener(COOKIE_CONSENT_GRANTED_EVENT, onGranted)
  }, [])

  return null
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}
