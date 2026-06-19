"use client"

import NextLink from "next/link"
import { useCallback, type ComponentProps } from "react"

import { Link as LocaleLink, useRouter as useLocaleRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type NextLinkProps = ComponentProps<typeof NextLink>
type LocaleLinkProps = ComponentProps<typeof LocaleLink>

type SharedProps = {
  prefetchOnHover?: boolean
  className?: string
  children?: React.ReactNode
  prefetch?: boolean
}

type Props =
  | (SharedProps & NextLinkProps & { localeAware?: false })
  | (SharedProps & LocaleLinkProps & { localeAware: true })

function hrefString(href: string | LocaleLinkProps["href"] | NextLinkProps["href"]): string {
  if (typeof href === "string") return href
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    return href.pathname
  }
  return "/"
}

/** Link with hover/touch prefetch + instant press feedback. */
export function FastLink(props: Props) {
  const {
    prefetchOnHover = true,
    className,
    children,
    prefetch,
    href,
    localeAware: localeAwareProp,
    ...rest
  } = props
  const localeAware = localeAwareProp === true
  const localeRouter = useLocaleRouter()
  const target = hrefString(href)

  const warm = useCallback(() => {
    if (!prefetchOnHover || target.startsWith("/#")) return
    try {
      localeRouter.prefetch(target)
    } catch {
      /* ignore */
    }
  }, [localeRouter, target, prefetchOnHover])

  const shared = {
    prefetch: prefetch ?? true,
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
    className: cn("affisell-fast-link", className),
  }

  if (localeAware) {
    const localeRest = rest as Omit<LocaleLinkProps, "href" | "children">
    return (
      <LocaleLink href={href} {...shared} {...localeRest}>
        {children}
      </LocaleLink>
    )
  }

  const nextRest = rest as Omit<NextLinkProps, "href" | "children">
  return (
    <NextLink href={href} {...shared} {...nextRest}>
      {children}
    </NextLink>
  )
}
