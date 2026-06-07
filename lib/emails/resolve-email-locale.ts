import type { AppLocale } from "@/lib/i18n-locale"
import { resolveAppLocale } from "@/lib/i18n-locale"

/** Resolve locale for transactional emails — defaults to FR marketplace tone. */
export function resolveEmailLocale(raw?: string | null): AppLocale {
  if (raw?.trim()) return resolveAppLocale(raw)
  return "fr"
}
