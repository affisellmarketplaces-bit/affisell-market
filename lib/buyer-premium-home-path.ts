import { pathnameWithoutLocale } from "@/lib/locale-path"

/** Buyer premium home owns its chrome — hide global SiteHeader on `/` and `/fr`. */
export function isBuyerPremiumHomePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const bare = pathnameWithoutLocale(pathname.split("?")[0] ?? pathname)
  return bare === "/"
}
