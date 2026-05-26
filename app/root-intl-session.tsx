"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

import { AnalyticsGated } from "@/components/legal/analytics-gated"
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner"
import { NavigationShell } from "@/components/navigation/navigation-shell"
import { ThemeProvider } from "@/components/providers/theme-provider"

export function RootSessionShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <NavigationShell />
        {children}
        <Toaster richColors position="top-center" />
        <CookieConsentBanner />
        <AnalyticsGated />
      </SessionProvider>
    </ThemeProvider>
  )
}
