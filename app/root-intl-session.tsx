"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

import { LocaleIntlProvider } from "@/components/navigation/locale-intl-provider"
import { NavigationShell } from "@/components/navigation/navigation-shell"
import { ThemeProvider } from "@/components/providers/theme-provider"

/**
 * next-intl + session + toasts. Locale from cookie (`affisell_locale`) via `LocaleIntlProvider`.
 */
export function RootIntlAndSession({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleIntlProvider>
        <SessionProvider>
          <NavigationShell />
          {children}
          <Toaster richColors position="top-center" />
        </SessionProvider>
      </LocaleIntlProvider>
    </ThemeProvider>
  )
}
