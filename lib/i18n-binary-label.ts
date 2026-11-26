/**
 * Legacy inline FR/EN label maps — non-FR locales use EN until a message key exists.
 *
 * Dependency-free on purpose: `lib/i18n-ui-locale.ts` (imported by the header's LanguageSwitcher on every page) used to
 * re-export this helper from `lib/i18n-pick-message.ts`, which then imported all eight catalogues into every page's
 * startup JavaScript. `tMessage()` now reads them through `#i18n-catalog` (in the browser: the page's own messages);
 * keep this module free of imports so that path cannot come back.
 */
export type BinaryLabel = { fr: string; en: string }

export function pickBinaryLabel(row: BinaryLabel, locale: string): string {
  return locale === "fr" ? row.fr : row.en
}
