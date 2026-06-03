"use client"

import { useEffect } from "react"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"

import { APP_TIME_ZONE, type AppLocale } from "@/lib/i18n-locale"

type Props = {
  locale: AppLocale
  messages: AbstractIntlMessages
  /** Server-rendered clock for relative date/time (avoids ENVIRONMENT_FALLBACK). */
  now: Date
  children: React.ReactNode
}

/**
 * Client mirror of server locale + messages (single source of truth).
 * Locale switches use a full navigation + `LocaleServerSync` reload — no cookie override here.
 */
export function IntlAppProvider({ locale, messages, now, children }: Props) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <NextIntlClientProvider
      key={locale}
      locale={locale}
      messages={messages}
      timeZone={APP_TIME_ZONE}
      now={now}
    >
      {children}
    </NextIntlClientProvider>
  )
}
