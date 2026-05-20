"use client"

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"

import type { AppLocale } from "@/lib/i18n-locale"

type Props = {
  locale: AppLocale
  messages: AbstractIntlMessages
  children: React.ReactNode
}

/** Client mirror of server locale + messages (no cookie race). */
export function IntlAppProvider({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider
      key={locale}
      locale={locale}
      messages={messages}
      timeZone="Europe/Paris"
    >
      {children}
    </NextIntlClientProvider>
  )
}
