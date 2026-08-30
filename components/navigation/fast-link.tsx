"use client"

import NextLink from "next/link"
import { useCallback, type ComponentProps, type FocusEvent, type MouseEvent, type TouchEvent } from "react"

import { Link as LocaleLink, useRouter as useLocaleRouter } from "@/i18n/navigation"
import { normalizePrefetchHref } from "@/lib/prefetch-href.client"
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
    if (!prefetchOnHover) return
    const path = normalizePrefetchHref(target)
    if (!path) return
    try {
      localeRouter.prefetch(path)
    } catch {
      /* ignore */
    }
  }, [localeRouter, target, prefetchOnHover])

  const shared = {
    prefetch: prefetch ?? true,
    className: cn("affisell-fast-link", className),
  }

  const nextRest = rest as Omit<NextLinkProps, "href" | "children"> & {
    onMouseEnter?: NextLinkProps["onMouseEnter"]
    onFocus?: NextLinkProps["onFocus"]
    onTouchStart?: NextLinkProps["onTouchStart"]
  }
  const {
    onMouseEnter: userMouseEnter,
    onFocus: userFocus,
    onTouchStart: userTouchStart,
    ...linkRest
  } = nextRest

  const composed = {
    ...shared,
    onMouseEnter: (event: MouseEvent<HTMLAnchorElement>) => {
      warm()
      userMouseEnter?.(event)
    },
    onFocus: (event: FocusEvent<HTMLAnchorElement>) => {
      warm()
      userFocus?.(event)
    },
    onTouchStart: (event: TouchEvent<HTMLAnchorElement>) => {
      warm()
      userTouchStart?.(event)
    },
  }

  if (localeAware) {
    const localeRest = linkRest as Omit<LocaleLinkProps, "href" | "children">
    return (
      <LocaleLink href={href} {...composed} {...localeRest}>
        {children}
      </LocaleLink>
    )
  }

  return (
    <NextLink href={href} {...composed} {...linkRest}>
      {children}
    </NextLink>
  )
}
