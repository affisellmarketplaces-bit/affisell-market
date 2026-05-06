"use client"

import { SessionProvider } from "next-auth/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/messages/en.json"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <SessionProvider>{children}</SessionProvider>
    </NextIntlClientProvider>
  )
}
