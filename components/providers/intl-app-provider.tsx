"use client"

import { useEffect, useState } from "react"
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl"

import {
  AFFISELL_LOCALE_CHANGE_EVENT,
  type AffisellLocaleChangeDetail,
} from "@/lib/i18n-locale-events"
import { APP_TIME_ZONE, type AppLocale } from "@/lib/i18n-locale"
import { CLIENT_MESSAGES, readLocaleFromDocumentCookie } from "@/lib/i18n-messages-client"

type Props = {
  locale: AppLocale
  messages: AbstractIntlMessages
  /** Server-rendered clock for relative date/time (avoids ENVIRONMENT_FALLBACK). */
  now: Date
  children: React.ReactNode
}

/**
 * Client mirror of server locale + messages.
 * Syncs cookie + live switcher events so cookie-driven routes update without a full reload.
 */
export function IntlAppProvider({ locale: serverLocale, messages: serverMessages, now, children }: Props) {
  const [locale, setLocale] = useState<AppLocale>(serverLocale)
  const [messages, setMessages] = useState<AbstractIntlMessages>(serverMessages)

  useEffect(() => {
    setLocale(serverLocale)
    setMessages(serverMessages)
  }, [serverLocale, serverMessages])

  useEffect(() => {
    const fromCookie = readLocaleFromDocumentCookie()
    if (fromCookie !== serverLocale) {
      setLocale(fromCookie)
      setMessages(CLIENT_MESSAGES[fromCookie])
    }
  }, [serverLocale])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    function onLocaleChange(event: Event) {
      const detail = (event as CustomEvent<AffisellLocaleChangeDetail>).detail
      const next = detail?.locale
      if (!next) return
      setLocale((prev) => {
        if (next === prev) return prev
        setMessages(CLIENT_MESSAGES[next])
        return next
      })
    }
    window.addEventListener(AFFISELL_LOCALE_CHANGE_EVENT, onLocaleChange)
    return () => window.removeEventListener(AFFISELL_LOCALE_CHANGE_EVENT, onLocaleChange)
  }, [])

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
