"use client"

import NextLink from "next/link"
import { type ComponentProps } from "react"

import { useResilientNavClick } from "@/hooks/use-resilient-nav-click"
import { cn } from "@/lib/utils"

type Props = Omit<ComponentProps<typeof NextLink>, "onClick">

function hrefString(href: Props["href"]): string {
  if (typeof href === "string") return href
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    const query =
      href.query && typeof href.query === "object"
        ? `?${new URLSearchParams(href.query as Record<string, string>).toString()}`
        : ""
    const hash = typeof href.hash === "string" ? href.hash : ""
    return `${href.pathname}${query}${hash}`
  }
  return "/"
}

/** @deprecated Prefer FastLink — kept for explicit catalog cards. */
export function ResilientLink({ href, className, children, prefetch = true, ...rest }: Props) {
  const target = hrefString(href)
  const shouldPrefetch = prefetch !== false && prefetch !== null
  const { onClick, warm } = useResilientNavClick(target, { prefetch: shouldPrefetch })

  return (
    <NextLink
      href={href}
      prefetch={prefetch === null ? undefined : prefetch}
      onClick={onClick}
      onPointerDown={warm}
      onMouseEnter={warm}
      onFocus={warm}
      className={cn("affisell-resilient-link affisell-fast-link", className)}
      {...rest}
    >
      {children}
    </NextLink>
  )
}
