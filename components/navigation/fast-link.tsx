"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

type Props = ComponentProps<typeof Link> & {
  prefetchOnHover?: boolean
}

function hrefString(href: Props["href"]): string {
  if (typeof href === "string") return href
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    return href.pathname
  }
  return "/"
}

/** Link with hover/touch prefetch + instant press feedback. */
export function FastLink({ href, prefetchOnHover = true, className, children, prefetch, ...rest }: Props) {
  const router = useRouter()
  const target = hrefString(href)

  const warm = useCallback(() => {
    if (!prefetchOnHover) return
    try {
      router.prefetch(target)
    } catch {
      /* ignore */
    }
  }, [router, target, prefetchOnHover])

  return (
    <Link
      href={href}
      prefetch={prefetch ?? true}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      className={cn("affisell-fast-link", className)}
      {...rest}
    >
      {children}
    </Link>
  )
}
