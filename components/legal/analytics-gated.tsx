"use client"

import { Analytics } from "@vercel/analytics/react"

import { useAnalyticsConsent } from "@/components/legal/cookie-consent-banner"

export function AnalyticsGated() {
  const allowed = useAnalyticsConsent()
  if (!allowed) return null
  return <Analytics />
}
