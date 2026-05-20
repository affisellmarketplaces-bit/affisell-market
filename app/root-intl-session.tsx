"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

import { LocaleIntlProvider } from "@/components/navigation/locale-intl-provider"
import { NavigationShell } from "@/components/navigation/navigation-shell"

/**
 * next-intl + session + toasts. Locale from cookie (`affisell_locale`) via `LocaleIntlProvider`.
 */
export function RootIntlAndSession({ children }: { children: React.ReactNode }) {
  return (
    <LocaleIntlProvider>
      <SessionProvider>
        <NavigationShell />
        {children}
        <Toaster richColors position="top-center" />
      </SessionProvider>
    </LocaleIntlProvider>
  )
}
