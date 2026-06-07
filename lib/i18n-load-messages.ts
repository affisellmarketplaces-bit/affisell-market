import type { AbstractIntlMessages } from "next-intl"

import type { AppLocale } from "@/lib/i18n-locale"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import de from "@/messages/de.json"
import es from "@/messages/es.json"
import it from "@/messages/it.json"
import nl from "@/messages/nl.json"
import pl from "@/messages/pl.json"
import zh from "@/messages/zh.json"

const FULL_BUNDLES: Record<AppLocale, AbstractIntlMessages> = {
  en: en as AbstractIntlMessages,
  fr: fr as AbstractIntlMessages,
  de: de as AbstractIntlMessages,
  es: es as AbstractIntlMessages,
  it: it as AbstractIntlMessages,
  nl: nl as AbstractIntlMessages,
  pl: pl as AbstractIntlMessages,
  zh: zh as AbstractIntlMessages,
}

/** Server + client message bundles — one full JSON per locale. */
export function loadAppMessages(locale: AppLocale): AbstractIntlMessages {
  return FULL_BUNDLES[locale] ?? FULL_BUNDLES.en
}

export const CLIENT_MESSAGES: Record<AppLocale, AbstractIntlMessages> = FULL_BUNDLES
