/**
 * Legacy FR/EN label maps — non-FR locales use EN until a message key exists.
 *
 * Kept apart from `lib/i18n-pick-message.ts` on purpose: that module imports EVERY message catalogue (8 languages,
 * ~3.6 MB of text), and `lib/i18n-ui-locale.ts` — imported by the header's LanguageSwitcher on every page — used to
 * re-export this helper from it, which put all eight catalogues in the JavaScript every visitor downloads at startup.
 */
export type BinaryLabel = { fr: string; en: string }

export function pickBinaryLabel(row: BinaryLabel, locale: string): string {
  return locale === "fr" ? row.fr : row.en
}
