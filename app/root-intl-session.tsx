"use client"

import { SessionProvider } from "next-auth/react"
import { NextIntlClientProvider } from "next-intl"
import { Toaster } from "sonner"

import { NavigationShell } from "@/components/navigation/navigation-shell"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

const clientLocale = process.env.NEXT_PUBLIC_MESSAGES_LOCALE?.toLowerCase() === "fr" ? "fr" : "en"
const clientMessages = clientLocale === "fr" ? fr : en

/**
 * next-intl + session + toasts. `timeZone` is set on `NextIntlClientProvider` for consistent dates.
 * Wired from `app/layout.tsx` as `<RootIntlAndSession>`.
 */
export function RootIntlAndSession({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={clientLocale} messages={clientMessages} timeZone="Europe/Paris">
      <SessionProvider>
        <NavigationShell />
        {children}
        <Toaster richColors position="top-center" />
      </SessionProvider>
    </NextIntlClientProvider>
  )
}
