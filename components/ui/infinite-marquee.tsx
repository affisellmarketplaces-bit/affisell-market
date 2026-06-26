"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const PX_PER_SEC = 28
const MIN_DURATION_SEC = 32
const MAX_DURATION_SEC = 96

type Props = {
  children: ReactNode
  className?: string
  /** Only auto-scroll when content is wider than the viewport. */
  autoOnlyWhenOverflow?: boolean
  /** When false, content is manually scrollable only (no CSS marquee). */
  autoAnimate?: boolean
}

/** Seamless horizontal marquee — pauses on hover/focus/touch; manual scroll if reduced motion. */
export function InfiniteMarquee({
  children,
  className,
  autoOnlyWhenOverflow = true,
  autoAnimate = true,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [durationSec, setDurationSec] = useState(45)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const measure = () => {
      const row = track.querySelector<HTMLElement>(".affisell-marquee__row")
      const contentWidth = row?.scrollWidth ?? track.scrollWidth
      const viewportWidth = viewport.clientWidth
      const overflow = contentWidth > viewportWidth + 12
      const shouldAnimate = autoAnimate && (!autoOnlyWhenOverflow || overflow)

      setActive(shouldAnimate)
      if (shouldAnimate) {
        const sec = Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, contentWidth / PX_PER_SEC))
        setDurationSec(sec)
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    if (track.firstElementChild) ro.observe(track.firstElementChild)
    return () => ro.disconnect()
  }, [autoAnimate, autoOnlyWhenOverflow, children])

  return (
    <div
      ref={viewportRef}
      className={cn(
        "affisell-marquee relative",
        active ? "affisell-marquee--active overflow-hidden" : "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <div
        ref={trackRef}
        className={cn("affisell-marquee__track flex w-max items-center gap-2", active && "affisell-marquee__track--animate")}
        style={active ? { animationDuration: `${durationSec}s` } : undefined}
      >
        <div className="affisell-marquee__row flex shrink-0 items-center gap-2">{children}</div>
        {active ? (
          <div className="affisell-marquee__row flex shrink-0 items-center gap-2" aria-hidden="true">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
