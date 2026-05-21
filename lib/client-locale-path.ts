import { routing } from "@/i18n/routing"
import type { AppLocale } from "@/lib/i18n-locale"

const LOCALE_PATTERN = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`)

/** Routes under `app/[locale]/` — only these get `/fr` in the URL. */
const URL_LOCALIZED_PATHS = new Set(["/", "/agent", "/creators", "/partners"])

export function pathnameWithoutLocaleClient(pathname: string): string {
  const m = pathname.match(LOCALE_PATTERN)
  if (!m) return pathname
  const rest = pathname.slice(m[0].length)
  return rest === "" ? "/" : rest
}

/** Build target URL after locale switch (cookie + optional path prefix). */
export function hrefForLocaleSwitch(
  pathname: string,
  search: string,
  hash: string,
  next: AppLocale
): string {
  const bare = pathnameWithoutLocaleClient(pathname)

  if (!URL_LOCALIZED_PATHS.has(bare)) {
    return `${bare}${search}${hash}`
  }

  const path =
    next === routing.defaultLocale
      ? bare
      : bare === "/"
        ? `/${next}`
        : `/${next}${bare}`
  return `${path}${search}${hash}`
}
