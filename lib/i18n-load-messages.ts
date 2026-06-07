import type { AbstractIntlMessages } from "next-intl"

import { deepMergeMessages } from "@/lib/i18n-merge-messages"
import type { AppLocale } from "@/lib/i18n-locale"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import de from "@/messages/de.json"
import es from "@/messages/es.json"
import it from "@/messages/it.json"
import nlOverrides from "@/messages/overrides/nl.json"
import plOverrides from "@/messages/overrides/pl.json"

const PARTIAL_LOCALE_OVERRIDES: Partial<Record<AppLocale, AbstractIntlMessages>> = {
  nl: nlOverrides as AbstractIntlMessages,
  pl: plOverrides as AbstractIntlMessages,
}

/** Server + client message bundles — EN fallback for partial locales. */
export function loadAppMessages(locale: AppLocale): AbstractIntlMessages {
  if (locale === "en") return en as AbstractIntlMessages
  if (locale === "fr") return fr as AbstractIntlMessages
  if (locale === "de") return de as AbstractIntlMessages
  if (locale === "es") return es as AbstractIntlMessages
  if (locale === "it") return it as AbstractIntlMessages
  const overrides = PARTIAL_LOCALE_OVERRIDES[locale]
  if (!overrides) return en as AbstractIntlMessages
  return deepMergeMessages(en as AbstractIntlMessages, overrides)
}

export const CLIENT_MESSAGES: Record<AppLocale, AbstractIntlMessages> = {
  en: loadAppMessages("en"),
  fr: loadAppMessages("fr"),
  de: loadAppMessages("de"),
  es: loadAppMessages("es"),
  it: loadAppMessages("it"),
  nl: loadAppMessages("nl"),
  pl: loadAppMessages("pl"),
}
