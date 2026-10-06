"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

type Props = {
  children: ReactNode
  /** Reserved height while the panel has not mounted yet, so the page does not jump when it appears. */
  minHeight?: number
  /** Mount right away (e.g. the user arrived via a deep link to this panel). */
  eager?: boolean
  rootMargin?: string
}

/**
 * Mounts `children` the first time the placeholder gets near the viewport, then keeps them mounted.
 *
 * The Brand Studio has ~20 panels; most sit far below the fold and do their own work on mount (data fetching, charts,
 * live previews). Mounting them all at once made the first paint and every later keystroke pay for panels nobody was
 * looking at. Wrapped around a `next/dynamic` component this also defers downloading its code.
 */
export function LazyPanel({ children, minHeight = 160, eager = false, rootMargin = "500px" }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(eager)

  useEffect(() => {
    if (eager) setShown(true)
  }, [eager])

  useEffect(() => {
    if (shown) return
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [shown, rootMargin])

  return (
    <div ref={ref}>
      {shown ? (
        children
      ) : (
        <div
          aria-hidden
          className="animate-pulse rounded-3xl bg-zinc-100/80 dark:bg-zinc-900/60"
          style={{ height: minHeight }}
        />
      )}
    </div>
  )
}
