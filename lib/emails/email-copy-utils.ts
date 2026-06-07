import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

export function emailSubject(locale: AppLocale, path: string, vars: Record<string, string | number>): string {
  return interpolate(tMessage(locale, path), vars)
}

export function formatEmailDate(date: Date, locale: AppLocale): string {
  return date.toLocaleDateString(intlLocaleTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
