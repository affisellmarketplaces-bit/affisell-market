"use client"

import NextLink from "next/link"
import { useCallback, type ComponentProps } from "react"

import { Link as LocaleLink, useRouter as useLocaleRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type NextLinkProps = ComponentProps<typeof NextLink>
type LocaleLinkProps = ComponentProps<typeof LocaleLink>

type Props = (NextLinkProps | LocaleLinkProps) & {
  prefetchOnHover?: boolean
  /** Use next-intl Link (e.g. `/creators` → `/fr/creators`). */
  localeAware?: boolean
}

function hrefString(href: Props["href"]): string {
  if (typeof href === "string") return href
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    return href.pathname
  }
  return "/"
}

/** Link with hover/touch prefetch + instant press feedback. */
export function FastLink({
  href,
  prefetchOnHover = true,
  localeAware = false,
  className,
  children,
  prefetch,
  ...rest
}: Props) {
  const localeRouter = useLocaleRouter()
  const target = hrefString(href)

  const warm = useCallback(() => {
    if (!prefetchOnHover || target.startsWith("/#")) return
    try {
      if (localeAware) localeRouter.prefetch(href as LocaleLinkProps["href"])
      else localeRouter.prefetch(target)
    } catch {
      /* ignore */
    }
  }, [localeAware, localeRouter, href, target, prefetchOnHover])

  const shared = {
    prefetch: prefetch ?? true,
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
    className: cn("affisell-fast-link", className),
    ...rest,
  }

  if (localeAware) {
    return (
      <LocaleLink href={href as LocaleLinkProps["href"]} {...shared}>
        {children}
      </LocaleLink>
    )
  }

  return (
    <NextLink href={href as NextLinkProps["href"]} {...shared}>
      {children}
    </NextLink>
  )
}
