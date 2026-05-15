"use client"

import { SessionProvider } from "next-auth/react"
import { NextIntlClientProvider } from "next-intl"
import { Toaster } from "sonner"

import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

const clientLocale = process.env.NEXT_PUBLIC_MESSAGES_LOCALE?.toLowerCase() === "fr" ? "fr" : "en"
const clientMessages = clientLocale === "fr" ? fr : en

/** UI copy: `NEXT_PUBLIC_MESSAGES_LOCALE=fr` loads `messages/fr.json`; money still uses `lib/market-config`. */
export function Providers({
  children,
  timeZone = "Europe/Paris",
}: {
  children: React.ReactNode
  /** IANA zone for next-intl formatting; set from `app/layout.tsx`. */
  timeZone?: string
}) {
  return (
    <NextIntlClientProvider locale={clientLocale} messages={clientMessages} timeZone={timeZone}>
      <SessionProvider>
        {children}
        <Toaster richColors position="top-center" />
      </SessionProvider>
    </NextIntlClientProvider>
  )
}
