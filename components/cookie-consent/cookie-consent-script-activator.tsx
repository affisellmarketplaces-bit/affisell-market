"use client"

import { useEffect } from "react"

import { COOKIE_CONSENT_GRANTED_EVENT } from "@/lib/legal/cookie-consent-constants"

function activateDeferredAnalyticsScripts() {
  document.querySelectorAll('script[type="text/plain"][data-category="analytics"]').forEach((node) => {
    const el = node as HTMLScriptElement
    const script = document.createElement("script")
    if (el.src) script.src = el.src
    if (el.id) script.id = `${el.id}-active`
    if (el.textContent) script.text = el.textContent
    script.async = true
    document.head.appendChild(script)
  })
}

/** Activates deferred analytics scripts after consent — no inline <script> in React tree. */
export function CookieConsentScriptActivator() {
  useEffect(() => {
    const onGranted = () => activateDeferredAnalyticsScripts()
    document.addEventListener(COOKIE_CONSENT_GRANTED_EVENT, onGranted)
    if (document.cookie.includes("affisell_cookie_consent=true")) {
      activateDeferredAnalyticsScripts()
    }
    return () => document.removeEventListener(COOKIE_CONSENT_GRANTED_EVENT, onGranted)
  }, [])

  return null
}
