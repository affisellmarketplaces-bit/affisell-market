import type { AbstractIntlMessages } from "next-intl"

import type { AppLocale } from "@/lib/i18n-locale"
import { deepMergeMessages } from "@/lib/i18n-merge-messages"
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

function buildLocaleMessages(locale: AppLocale): AbstractIntlMessages {
  if (locale === "en") return FULL_BUNDLES.en
  const override = FULL_BUNDLES[locale]
  if (!override) return FULL_BUNDLES.en
  return deepMergeMessages(FULL_BUNDLES.en, override)
}

/** Server + client message bundles — EN base with locale overrides (missing keys fall back to EN). */
export function loadAppMessages(locale: AppLocale): AbstractIntlMessages {
  return buildLocaleMessages(locale)
}

export const CLIENT_MESSAGES: Record<AppLocale, AbstractIntlMessages> = {
  en: buildLocaleMessages("en"),
  fr: buildLocaleMessages("fr"),
  de: buildLocaleMessages("de"),
  es: buildLocaleMessages("es"),
  it: buildLocaleMessages("it"),
  nl: buildLocaleMessages("nl"),
  pl: buildLocaleMessages("pl"),
  zh: buildLocaleMessages("zh"),
}
