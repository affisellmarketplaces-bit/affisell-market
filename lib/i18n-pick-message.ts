import type { AbstractIntlMessages } from "next-intl"

import { CLIENT_MESSAGES } from "@/lib/i18n-load-messages"
import type { AppLocale } from "@/lib/i18n-locale"

function getNestedValue(messages: AbstractIntlMessages, path: string): unknown {
  const parts = path.split(".")
  let cur: unknown = messages
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Resolve a dotted message path from pre-merged locale bundles (falls back to EN). */
export function tMessage(locale: AppLocale, path: string, fallback?: string): string {
  const bundle = CLIENT_MESSAGES[locale] ?? CLIENT_MESSAGES.en
  const primary = getNestedValue(bundle, path)
  if (typeof primary === "string" && primary.trim()) return primary

  if (locale !== "en") {
    const en = getNestedValue(CLIENT_MESSAGES.en, path)
    if (typeof en === "string" && en.trim()) return en
  }

  return fallback ?? path
}

export type BinaryLabel = { fr: string; en: string }

/** Legacy FR/EN maps — non-FR locales use EN until a message key exists. */
export function pickBinaryLabel(row: BinaryLabel, locale: string): string {
  return locale === "fr" ? row.fr : row.en
}
