/**
 * Legacy inline FR/EN label maps — non-FR locales use EN until a message key exists.
 *
 * Kept apart from `lib/i18n-pick-message.ts` on purpose: that module loads every locale catalog (`CLIENT_MESSAGES`,
 * ~2.2 MB of JS once bundled), and the locale switcher reached it only for this two-line helper, which put all eight
 * catalogs on every page.
 */
export type BinaryLabel = { fr: string; en: string }

export function pickBinaryLabel(row: BinaryLabel, locale: string): string {
  return locale === "fr" ? row.fr : row.en
}
