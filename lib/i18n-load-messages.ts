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
  en: en as unknown as AbstractIntlMessages,
  fr: fr as unknown as AbstractIntlMessages,
  de: de as unknown as AbstractIntlMessages,
  es: es as unknown as AbstractIntlMessages,
  it: it as unknown as AbstractIntlMessages,
  nl: nl as unknown as AbstractIntlMessages,
  pl: pl as unknown as AbstractIntlMessages,
  zh: zh as unknown as AbstractIntlMessages,
}

const MERGED_CACHE = new Map<AppLocale, AbstractIntlMessages>()

function buildLocaleMessages(locale: AppLocale): AbstractIntlMessages {
  if (locale === "en") return FULL_BUNDLES.en
  const override = FULL_BUNDLES[locale]
  if (!override) return FULL_BUNDLES.en
  return deepMergeMessages(FULL_BUNDLES.en, override)
}

/** Server + client message bundles — EN base with locale overrides (missing keys fall back to EN). */
export function loadAppMessages(locale: AppLocale): AbstractIntlMessages {
  const cached = MERGED_CACHE.get(locale)
  if (cached) return cached
  const built = buildLocaleMessages(locale)
  MERGED_CACHE.set(locale, built)
  return built
}

const CLIENT_MESSAGES_CACHE = new Map<AppLocale, AbstractIntlMessages>()

function getClientMessages(locale: AppLocale): AbstractIntlMessages {
  const cached = CLIENT_MESSAGES_CACHE.get(locale)
  if (cached) return cached
  const built = buildLocaleMessages(locale)
  CLIENT_MESSAGES_CACHE.set(locale, built)
  return built
}

/** Lazy per-locale bundles — avoids 7× deepMerge at module import (client perf + error boundaries). */
export const CLIENT_MESSAGES: Record<AppLocale, AbstractIntlMessages> = new Proxy(
  {} as Record<AppLocale, AbstractIntlMessages>,
  {
    get(_target, prop) {
      if (typeof prop !== "string" || !(prop in FULL_BUNDLES)) return undefined
      return getClientMessages(prop as AppLocale)
    },
    ownKeys() {
      return Object.keys(FULL_BUNDLES)
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === "string" && prop in FULL_BUNDLES) {
        return {
          configurable: true,
          enumerable: true,
          value: getClientMessages(prop as AppLocale),
        }
      }
      return undefined
    },
  }
)
