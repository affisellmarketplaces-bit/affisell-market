"use client"

import { useEffect, useState } from "react"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"

import { APP_TIME_ZONE, resolveAppLocale, type AppLocale } from "@/lib/i18n-locale"
import { CLIENT_MESSAGES, readLocaleFromDocumentCookie } from "@/lib/i18n-messages-client"

type Props = {
  children: React.ReactNode
}

/** Client provider: reads locale cookie, falls back to env default on first paint. */
export function LocaleIntlProvider({ children }: Props) {
  const envDefault = resolveAppLocale(process.env.NEXT_PUBLIC_MESSAGES_LOCALE)
  const [locale, setLocale] = useState<AppLocale>(envDefault)

  useEffect(() => {
    setLocale(readLocaleFromDocumentCookie())
  }, [])

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={CLIENT_MESSAGES[locale]}
      timeZone={APP_TIME_ZONE}
      now={new Date()}
    >
      {children}
    </NextIntlClientProvider>
  )
}
