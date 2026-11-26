import type { AbstractIntlMessages } from "next-intl"

// `#i18n-catalog`: every catalog on the server, the page's provider messages in the browser (package.json "imports").
import { catalogMessages } from "#i18n-catalog"
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
  const bundle = catalogMessages(locale) ?? catalogMessages("en")
  const primary = bundle ? getNestedValue(bundle, path) : undefined
  if (typeof primary === "string" && primary.trim()) return primary

  if (locale !== "en") {
    const enBundle = catalogMessages("en")
    const en = enBundle ? getNestedValue(enBundle, path) : undefined
    if (typeof en === "string" && en.trim()) return en
  }

  return fallback ?? path
}

export { pickBinaryLabel, type BinaryLabel } from "@/lib/i18n-binary-label"
