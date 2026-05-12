"use client"

import { SessionProvider } from "next-auth/react"
import { NextIntlClientProvider } from "next-intl"
import { Toaster } from "sonner"

import messages from "@/messages/en.json"

/** next-intl message locale stays `en` until you add `messages/fr.json` etc.; money uses `lib/market-config`. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <SessionProvider>
        {children}
        <Toaster richColors position="top-center" />
      </SessionProvider>
    </NextIntlClientProvider>
  )
}
