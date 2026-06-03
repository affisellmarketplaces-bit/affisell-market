import { routing } from "@/i18n/routing"
import type { AppLocale } from "@/lib/i18n-locale"
import { pathnameWithoutLocale, URL_LOCALIZED_PATHS } from "@/lib/locale-path"

export function pathnameWithoutLocaleClient(pathname: string): string {
  return pathnameWithoutLocale(pathname)
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
