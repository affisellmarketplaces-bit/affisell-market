import type { AbstractIntlMessages } from "next-intl"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  resolveAppLocale,
  type AppLocale,
} from "@/lib/i18n-locale"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"

export const CLIENT_MESSAGES: Record<AppLocale, AbstractIntlMessages> = { en, fr }

export function readLocaleFromDocumentCookie(): AppLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=(en|fr)`))
  return resolveAppLocale(match?.[1])
}
