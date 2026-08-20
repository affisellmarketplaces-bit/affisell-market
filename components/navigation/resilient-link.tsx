"use client"

import NextLink from "next/link"
import {
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
  type MouseEvent,
} from "react"
import { usePathname } from "next/navigation"

import { useSafeAppRouter } from "@/hooks/use-safe-app-router"
import { buyerHaptic } from "@/lib/buyer-haptics"
import { signalInstantNavigationStart } from "@/lib/instant-navigation-events.client"
import { normalizePrefetchHref } from "@/lib/prefetch-href.client"
import {
  hrefPathFromString,
  isInPageHashLink,
  releaseResilientNavLock,
  RESILIENT_NAV_STALL_MS,
  shouldHardFallbackNav,
  tryAcquireResilientNavLock,
} from "@/lib/resilient-nav"
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

function hrefPath(href: Props["href"]): string {
  return hrefPathFromString(hrefString(href))
}

/**
 * Buyer catalog / PDP link — soft nav + hard fallback when dev webpack stalls.
 * Native `<a href>` stays in DOM for SEO, middle-click, and no-JS.
 */
export function ResilientLink({
  href,
  className,
  children,
  prefetch = true,
  ...rest
}: Props) {
  const pathname = usePathname() ?? ""
  const { push, prefetch: routerPrefetch, mounted } = useSafeAppRouter()
  const stallTimer = useRef<number | null>(null)
  const target = hrefString(href)
  const targetPath = hrefPath(href)

  useEffect(() => {
    if (!mounted || !prefetch) return
    const path = normalizePrefetchHref(target)
    if (!path) return
    try {
      routerPrefetch(path)
    } catch {
      /* warming */
    }
  }, [mounted, prefetch, routerPrefetch, target])

  useEffect(() => {
    if (stallTimer.current != null) {
      window.clearTimeout(stallTimer.current)
      stallTimer.current = null
    }
    releaseResilientNavLock()
  }, [pathname])

  useEffect(
    () => () => {
      if (stallTimer.current != null) window.clearTimeout(stallTimer.current)
    },
    []
  )

  const warm = useCallback(() => {
    if (!mounted || !prefetch) return
    const path = normalizePrefetchHref(target)
    if (!path) return
    try {
      routerPrefetch(path)
    } catch {
      /* ignore */
    }
  }, [mounted, prefetch, routerPrefetch, target])

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      if (isInPageHashLink(target)) {
        event.preventDefault()
        const hash = target.includes("#") ? target.slice(target.indexOf("#") + 1) : ""
        if (hash) {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        return
      }

      if (!tryAcquireResilientNavLock()) return

      buyerHaptic("tap")
      signalInstantNavigationStart()

      if (pathname === targetPath) {
        event.preventDefault()
        releaseResilientNavLock()
        window.scrollTo({ top: 0, behavior: "smooth" })
        return
      }

      event.preventDefault()
      push(target)

      if (stallTimer.current != null) window.clearTimeout(stallTimer.current)
      stallTimer.current = window.setTimeout(() => {
        releaseResilientNavLock()
        if (shouldHardFallbackNav(targetPath, window.location.pathname)) {
          console.warn("[resilient-link]", { href: target, result: "hard-fallback" })
          window.location.assign(target)
        }
      }, RESILIENT_NAV_STALL_MS)
    },
    [pathname, push, target, targetPath]
  )

  return (
    <NextLink
      href={href}
      prefetch={prefetch}
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
