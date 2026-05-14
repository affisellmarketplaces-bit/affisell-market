"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Magnification factor for the hover pane (Amazon-style). */
const ZOOM = 2.35

type Props = {
  src: string
  alt: string
  /** Badges / chips over the hero (e.g. “360°”). */
  overlay?: ReactNode
  /** Outer wrapper (grid cell). */
  className?: string
  /** Inner frame around the main image (aspect, radius). */
  frameClassName?: string
}

/**
 * Desktop (lg+): main product image with a side pane that magnifies the region under the cursor.
 * Touch / coarse pointer: hero only, no zoom pane (avoids broken UX).
 */
export function ProductImageHoverZoom({ src, alt, overlay, className, frameClassName }: Props) {
  const heroRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  const [pct, setPct] = useState({ x: 50, y: 50 })
  const [finePointer, setFinePointer] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia(
      "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
    )
    const apply = () => setFinePointer(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    setHover(false)
    setPct({ x: 50, y: 50 })
  }, [src])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((e.clientX - r.left) / Math.max(1, r.width)) * 100
    const y = ((e.clientY - r.top) / Math.max(1, r.height)) * 100
    setPct({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) })
  }, [])

  const lensSpan = 100 / ZOOM
  const lensLeft = Math.min(100 - lensSpan, Math.max(0, pct.x - lensSpan / 2))
  const lensTop = Math.min(100 - lensSpan, Math.max(0, pct.y - lensSpan / 2))

  const zoomBg = src ? `url(${JSON.stringify(src)})` : undefined

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:flex lg:items-stretch lg:gap-3 lg:p-2",
        className
      )}
      onMouseEnter={() => finePointer && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseMove={finePointer ? onMove : undefined}
    >
      <div className="relative min-w-0 flex-1">
        <div
          ref={heroRef}
          className={cn(
            "relative aspect-[4/5] overflow-hidden bg-zinc-50 sm:aspect-square dark:bg-zinc-900/80",
            frameClassName
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote listing URLs */}
          <img
            key={src}
            src={src}
            alt={alt}
            draggable={false}
            className="h-full w-full select-none object-contain p-4 transition duration-300 ease-out animate-in fade-in-0"
          />
          {finePointer && hover ? (
            <div
              className="pointer-events-none absolute z-[1] rounded-md border-2 border-white/95 shadow-lg ring-2 ring-black/25 dark:ring-white/20"
              style={{
                left: `${lensLeft}%`,
                top: `${lensTop}%`,
                width: `${lensSpan}%`,
                height: `${lensSpan}%`,
              }}
              aria-hidden
            />
          ) : null}
          {overlay ? <div className="pointer-events-none absolute inset-0 z-[2]">{overlay}</div> : null}
        </div>
      </div>

      {finePointer ? (
        <div
          role="region"
          aria-label={hover ? "Magnified product image" : "Product image zoom"}
          className={cn(
            "relative mt-4 hidden aspect-square w-full shrink-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/60 lg:mt-0 lg:block lg:w-[min(42vw,24rem)] xl:w-[min(38vw,28rem)]",
            hover ? "ring-2 ring-violet-500/25" : "opacity-95"
          )}
        >
          <div
            className="h-full w-full bg-no-repeat transition-[background-position,opacity] duration-75 ease-out"
            style={{
              backgroundImage: zoomBg,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${ZOOM * 100}% auto`,
              backgroundPosition: `${pct.x}% ${pct.y}%`,
              opacity: hover ? 1 : 0.4,
            }}
          />
          {!hover ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Hover image to zoom
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
