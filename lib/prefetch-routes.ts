"use client"

import { startTransition } from "react"

import { scheduleRouterAction } from "@/lib/safe-app-router"

/** Prefetch a list of app routes — safe to call after the App Router has hydrated. */
export function prefetchRoutes(
  prefetch: (href: string) => void,
  routes: readonly string[]
): void {
  scheduleRouterAction(() => {
    startTransition(() => {
      for (const path of routes) {
        if (!path || path.startsWith("/#")) continue
        try {
          prefetch(path)
        } catch {
          /* router not ready yet */
        }
      }
    })
  })
}

/**
 * Defer route prefetch until idle (never synchronously on mount).
 * Avoids Next.js "Router action dispatched before initialization" in dev.
 */
export function schedulePrefetchRoutes(
  prefetch: (href: string) => void,
  routes: readonly string[],
  options?: { idleTimeoutMs?: number; fallbackDelayMs?: number }
): () => void {
  const idleTimeoutMs = options?.idleTimeoutMs ?? 2000
  const fallbackDelayMs = options?.fallbackDelayMs ?? 400

  const run = () => prefetchRoutes(prefetch, routes)

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: idleTimeoutMs })
    return () => window.cancelIdleCallback(id)
  }

  const t = window.setTimeout(run, fallbackDelayMs)
  return () => window.clearTimeout(t)
}
