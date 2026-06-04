"use client"

import CookieConsent from "react-cookie-consent"
import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import {
  applyConsentChoice,
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_MAX_AGE_DAYS,
  readCookieConsentPrefsFromDocument,
  removeNonEssentialCookies,
} from "@/lib/legal/cookie-consent-runtime"
import { COOKIE_CONSENT_COOKIE } from "@/lib/legal/consent"
import { isImmersiveBuyerRoute } from "@/lib/mobile-chrome"

export default function CookieBanner() {
  const pathname = usePathname() ?? ""

  if (isImmersiveBuyerRoute(pathname)) return null

  const handleAccept = () => {
    applyConsentChoice({
      essential: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    })
  }

  const handleDecline = () => {
    applyConsentChoice({
      essential: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    })
    removeNonEssentialCookies()
  }

  return (
    <CookieConsent
      location="bottom"
      buttonText="Accepter"
      declineButtonText="Refuser"
      enableDeclineButton
      cookieName={COOKIE_CONSENT_COOKIE}
      cookieValue="true"
      declineCookieValue="false"
      expires={COOKIE_CONSENT_MAX_AGE_DAYS}
      sameSite="lax"
      onAccept={handleAccept}
      onDecline={handleDecline}
      style={{ background: "#1a1a1a", alignItems: "center", zIndex: 9999 }}
      buttonStyle={{
        background: "#4F46E5",
        color: "#fff",
        fontSize: "14px",
        borderRadius: "6px",
      }}
      declineButtonStyle={{
        background: "#374151",
        color: "#fff",
        fontSize: "14px",
        borderRadius: "6px",
      }}
      containerClasses="!fixed !bottom-[var(--affisell-mobile-dock-offset,0px)] md:!bottom-0"
    >
      <span className="text-sm text-white">
        On utilise des cookies pour mesurer l&apos;audience et améliorer Affisell.{" "}
        <Link href="/cookies" className="ml-1 underline">
          Paramétrer
        </Link>
      </span>
    </CookieConsent>
  )
}

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
