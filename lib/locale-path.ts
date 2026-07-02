import { routing } from "@/i18n/routing"

const LOCALE_PATTERN = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`)

/** Strip `/en` or `/fr` prefix for legacy middleware path checks. */
export function pathnameWithoutLocale(pathname: string): string {
  const m = pathname.match(LOCALE_PATTERN)
  if (!m) return pathname
  const rest = pathname.slice(m[0].length)
  return rest === "" ? "/" : rest
}

export function localeFromPathname(pathname: string): string | null {
  const m = pathname.match(LOCALE_PATTERN)
  return m?.[1] ?? null
}

/** Routes under `app/[locale]/` — only these get `/fr` in the URL. */
export const URL_LOCALIZED_PATHS = new Set(["/", "/agent", "/creators", "/partners", "/enterprise"])
