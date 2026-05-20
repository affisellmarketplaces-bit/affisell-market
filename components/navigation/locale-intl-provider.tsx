"use client"

import { useEffect, useState } from "react"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  resolveAppLocale,
  type AppLocale,
} from "@/lib/i18n-locale"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

const MESSAGES: Record<AppLocale, AbstractIntlMessages> = { en, fr }

function readLocaleFromCookie(): AppLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=(en|fr)`))
  return resolveAppLocale(match?.[1])
}

type Props = {
  children: React.ReactNode
}

/** Client provider: reads locale cookie, falls back to env default on first paint. */
export function LocaleIntlProvider({ children }: Props) {
  const envDefault = resolveAppLocale(process.env.NEXT_PUBLIC_MESSAGES_LOCALE)
  const [locale, setLocale] = useState<AppLocale>(envDefault)

  useEffect(() => {
    setLocale(readLocaleFromCookie())
  }, [])

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Paris">
      {children}
    </NextIntlClientProvider>
  )
}
