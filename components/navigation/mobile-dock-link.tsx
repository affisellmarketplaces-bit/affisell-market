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
import {
  MOBILE_DOCK_NAV_STALL_MS,
  releaseDockNavLock,
  shouldHardFallbackNav,
  tryAcquireDockNavLock,
} from "@/lib/mobile-dock-nav"
import { cn } from "@/lib/utils"

type Props = Omit<ComponentProps<typeof NextLink>, "onClick" | "prefetch">

function hrefPath(href: Props["href"]): string {
  if (typeof href === "string") return href.split("?")[0] ?? "/"
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    return href.pathname
  }
  return "/"
}

function hrefString(href: Props["href"]): string {
  if (typeof href === "string") return href
  if (href && typeof href === "object" && "pathname" in href && href.pathname) {
    const query =
      href.query && typeof href.query === "object"
        ? `?${new URLSearchParams(href.query as Record<string, string>).toString()}`
        : ""
    return `${href.pathname}${query}`
  }
  return "/"
}

/** Thumb-dock link — prefetch + soft nav with hard fallback when dev webpack stalls. */
export function MobileDockLink({ href, className, children, ...rest }: Props) {
  const pathname = usePathname() ?? ""
  const { push, prefetch, mounted } = useSafeAppRouter()
  const stallTimer = useRef<number | null>(null)
  const target = hrefString(href)
  const targetPath = hrefPath(href)

  useEffect(() => {
    if (!mounted) return
    try {
      prefetch(target)
    } catch {
      /* router warming */
    }
  }, [mounted, prefetch, target])

  useEffect(() => {
    if (stallTimer.current != null) {
      window.clearTimeout(stallTimer.current)
      stallTimer.current = null
    }
    releaseDockNavLock()
  }, [pathname])

  useEffect(
    () => () => {
      if (stallTimer.current != null) window.clearTimeout(stallTimer.current)
    },
    []
  )

  const warm = useCallback(() => {
    if (!mounted) return
    try {
      prefetch(target)
    } catch {
      /* ignore */
    }
  }, [mounted, prefetch, target])

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const lock = tryAcquireDockNavLock(target)
      if (lock === "repeat-hard-fallback") {
        event.preventDefault()
        console.warn("[mobile-dock-link]", { href: target, result: "repeat-hard-fallback" })
        window.location.assign(target)
        return
      }

      buyerHaptic("tap")
      signalInstantNavigationStart()

      if (pathname === targetPath) {
        event.preventDefault()
        releaseDockNavLock()
        window.scrollTo({ top: 0, behavior: "smooth" })
        return
      }

      if (!mounted) {
        releaseDockNavLock()
        return
      }

      event.preventDefault()
      push(target)

      if (stallTimer.current != null) window.clearTimeout(stallTimer.current)
      stallTimer.current = window.setTimeout(() => {
        releaseDockNavLock()
        if (shouldHardFallbackNav(targetPath, window.location.pathname)) {
          console.warn("[mobile-dock-link]", { href: target, result: "hard-fallback" })
          window.location.assign(target)
        }
      }, MOBILE_DOCK_NAV_STALL_MS)
    },
    [pathname, push, target, targetPath]
  )

  return (
    <NextLink
      href={href}
      prefetch
      onClick={onClick}
      onPointerDown={warm}
      onMouseEnter={warm}
      onFocus={warm}
      className={cn("affisell-mobile-dock-link affisell-fast-link", className)}
      {...rest}
    >
      {children}
    </NextLink>
  )
}
