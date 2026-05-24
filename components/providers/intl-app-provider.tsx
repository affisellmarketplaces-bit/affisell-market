"use client"

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"

import { APP_TIME_ZONE, type AppLocale } from "@/lib/i18n-locale"

type Props = {
  locale: AppLocale
  messages: AbstractIntlMessages
  /** Server-rendered clock for relative date/time (avoids ENVIRONMENT_FALLBACK). */
  now: Date
  children: React.ReactNode
}

/** Client mirror of server locale + messages (no cookie race). */
export function IntlAppProvider({ locale, messages, now, children }: Props) {
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
