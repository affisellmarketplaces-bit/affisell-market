import Link from "next/link"
import type { ComponentProps } from "react"

import { Link as LocaleLink } from "@/i18n/navigation"
import { isStaticAppPathname } from "@/lib/reserved-locale-segments"
import { URL_LOCALIZED_PATHS } from "@/lib/locale-path"

type Href = ComponentProps<typeof LocaleLink>["href"]

function hrefPathname(href: Href): string {
  if (typeof href === "string") return href.split("?")[0]?.split("#")[0] ?? href
  if (typeof href === "object" && href !== null && "pathname" in href) {
    return String(href.pathname ?? "")
  }
  return ""
}

function isBareStaticAppPath(path: string): boolean {
  if (!path || !isStaticAppPathname(path)) return false
  const bare = path.split("?")[0]?.split("#")[0] ?? path
  return !URL_LOCALIZED_PATHS.has(bare)
}

/**
 * Locale-aware link for `[locale]` pages; plain `/login`, `/signup`, etc. stay unprefixed.
 */
export function AppLink({ href, ...props }: ComponentProps<typeof LocaleLink>) {
  const path = hrefPathname(href)
  if (path && isBareStaticAppPath(path)) {
    return <Link href={typeof href === "string" ? href : path} {...props} />
  }
  return <LocaleLink href={href} {...props} />
}
