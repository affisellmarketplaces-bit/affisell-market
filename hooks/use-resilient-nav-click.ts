"use client"

import { useCallback, useEffect, useRef, type MouseEvent } from "react"
import { usePathname } from "next/navigation"

import { useRouter as useLocaleRouter } from "@/i18n/navigation"
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

type Options = {
  prefetch?: boolean
  /** Use next-intl router (marketing `/` + `/fr` routes). */
  localeAware?: boolean
}

/** Soft navigation with hard fallback when dev webpack stalls — shared by header + catalog. */
export function useResilientNavClick(href: string, options: Options = {}) {
  const { prefetch = true, localeAware = false } = options
  const pathname = usePathname() ?? ""
  const { push, prefetch: routerPrefetch, mounted } = useSafeAppRouter()
  const localeRouter = useLocaleRouter()
  const stallTimer = useRef<number | null>(null)
  const targetPath = hrefPathFromString(href)

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
    const path = normalizePrefetchHref(href)
    if (!path) return
    try {
      if (localeAware) localeRouter.prefetch(path)
      else routerPrefetch(path)
    } catch {
      /* warming */
    }
  }, [href, localeAware, localeRouter, mounted, prefetch, routerPrefetch])

  const scheduleHardFallback = useCallback(() => {
    if (stallTimer.current != null) window.clearTimeout(stallTimer.current)
    stallTimer.current = window.setTimeout(() => {
      releaseResilientNavLock()
      if (shouldHardFallbackNav(targetPath, window.location.pathname)) {
        console.warn("[resilient-nav]", { href, result: "hard-fallback" })
        window.location.assign(href)
      }
    }, RESILIENT_NAV_STALL_MS)
  }, [href, targetPath])

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      if (isInPageHashLink(href)) {
        event.preventDefault()
        const hash = href.includes("#") ? href.slice(href.indexOf("#") + 1) : ""
        if (hash) {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        return
      }

      const lock = tryAcquireResilientNavLock(href)
      if (lock === "repeat-hard-fallback") {
        event.preventDefault()
        console.warn("[resilient-nav]", { href, result: "repeat-hard-fallback" })
        window.location.assign(href)
        return
      }

      buyerHaptic("tap")
      signalInstantNavigationStart()

      if (pathname === targetPath) {
        event.preventDefault()
        releaseResilientNavLock()
        window.scrollTo({ top: 0, behavior: "smooth" })
        return
      }

      if (!mounted) {
        releaseResilientNavLock()
        return
      }

      event.preventDefault()
      if (localeAware) localeRouter.push(href)
      else push(href)

      scheduleHardFallback()
    },
    [href, localeAware, localeRouter, mounted, pathname, push, scheduleHardFallback, targetPath]
  )

  return { onClick, warm }
}
