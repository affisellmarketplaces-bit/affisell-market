"use client"

import { startTransition } from "react"

const ROUTER_NOT_READY = "Router action dispatched before initialization"

export function isRouterNotReadyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes(ROUTER_NOT_READY)
}

/**
 * Defer push/replace/prefetch until the App Router action queue exists (post-hydration).
 * Retries briefly when Next throws "dispatched before initialization".
 */
export function scheduleRouterAction(run: () => void): () => void {
  if (typeof window === "undefined") return () => {}

  let cancelled = false
  let retryTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let raf2 = 0

  const invoke = (retriesLeft: number) => {
    if (cancelled) return
    startTransition(() => {
      try {
        run()
      } catch (err) {
        if (retriesLeft > 0 && isRouterNotReadyError(err)) {
          retryTimer = globalThis.setTimeout(() => invoke(retriesLeft - 1), 48)
        }
      }
    })
  }

  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => invoke(4))
  })

  return () => {
    cancelled = true
    cancelAnimationFrame(raf1)
    if (raf2) cancelAnimationFrame(raf2)
    if (retryTimer) globalThis.clearTimeout(retryTimer)
  }
}

export type AppRouterLike = {
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
  prefetch: (href: string) => void
  refresh?: () => void
}

export function runSafeRouterPush(
  router: AppRouterLike,
  href: string,
  options?: { scroll?: boolean }
): void {
  scheduleRouterAction(() => router.push(href, options))
}

export function runSafeRouterReplace(
  router: AppRouterLike,
  href: string,
  options?: { scroll?: boolean }
): void {
  scheduleRouterAction(() => router.replace(href, options))
}

export function runSafeRouterPrefetch(router: AppRouterLike, href: string): void {
  scheduleRouterAction(() => router.prefetch(href))
}

export function runSafeRouterRefresh(router: AppRouterLike): void {
  if (!router.refresh) return
  scheduleRouterAction(() => router.refresh!())
}
