"use client"

import NextLink from "next/link"
import { useCallback, type ComponentProps, type MouseEvent } from "react"

import { Link as LocaleLink, useRouter as useLocaleRouter } from "@/i18n/navigation"
import { useResilientNavClick } from "@/hooks/use-resilient-nav-click"
import { normalizePrefetchHref } from "@/lib/prefetch-href.client"
import { cn } from "@/lib/utils"

type NextLinkProps = ComponentProps<typeof NextLink>
type LocaleLinkProps = ComponentProps<typeof LocaleLink>

type SharedProps = {
  prefetchOnHover?: boolean
  className?: string
  children?: React.ReactNode
  prefetch?: boolean
  resilient?: boolean
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

/** Link with hover prefetch + resilient navigation (dev-safe). */
export function FastLink(props: Props) {
  const {
    prefetchOnHover = true,
    className,
    children,
    prefetch,
    href,
    localeAware: localeAwareProp,
    resilient = true,
    onClick: userOnClick,
    ...rest
  } = props
  const localeAware = localeAwareProp === true
  const localeRouter = useLocaleRouter()
  const target = hrefString(href)
  const { onClick: resilientClick, warm: resilientWarm } = useResilientNavClick(target, {
    prefetch: prefetch ?? true,
    localeAware,
  })

  const warm = useCallback(() => {
    if (!prefetchOnHover) return
    if (resilient) {
      resilientWarm()
      return
    }
    const path = normalizePrefetchHref(target)
    if (!path) return
    try {
      localeRouter.prefetch(path)
    } catch {
      /* ignore */
    }
  }, [localeRouter, prefetchOnHover, resilient, resilientWarm, target])

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (resilient) resilientClick(event)
      userOnClick?.(event)
    },
    [resilient, resilientClick, userOnClick]
  )

  const shared = {
    prefetch: prefetch ?? true,
    onClick,
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
    onPointerDown: warm,
    className: cn("affisell-fast-link", resilient && "affisell-resilient-link", className),
  }

  if (localeAware) {
    const localeRest = rest as Omit<LocaleLinkProps, "href" | "children">
    return (
      <LocaleLink href={href} {...shared} {...localeRest}>
        {children}
      </LocaleLink>
    )
  }

  const nextRest = rest as Omit<NextLinkProps, "href" | "children" | "onClick">
  return (
    <NextLink href={href} {...shared} {...nextRest}>
      {children}
    </NextLink>
  )
}
