"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Magnification factor for the hover loupe. */
const ZOOM = 2.35

const PLACEHOLDER_SRC = "/placeholder-product.jpg"

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
 * Desktop (lg+): hero image + floating loupe (absolute, no layout shift).
 * Touch / coarse pointer: hero only.
 */
export function ProductImageHoverZoom({ src, alt, overlay, className, frameClassName }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const [pointerInHero, setPointerInHero] = useState(false)
  const [zoomEngaged, setZoomEngaged] = useState(false)
  const [pct, setPct] = useState({ x: 50, y: 50 })
  const [finePointer, setFinePointer] = useState(false)
  const [displaySrc, setDisplaySrc] = useState(src)

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
    setDisplaySrc(src?.trim() || PLACEHOLDER_SRC)
    setPointerInHero(false)
    setZoomEngaged(false)
    setPct({ x: 50, y: 50 })
  }, [src])

  const zoomActive = finePointer && pointerInHero && zoomEngaged

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = heroRef.current
      if (!el) return
      if (finePointer) setZoomEngaged(true)
      const r = el.getBoundingClientRect()
      const x = ((e.clientX - r.left) / Math.max(1, r.width)) * 100
      const y = ((e.clientY - r.top) / Math.max(1, r.height)) * 100
      setPct({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) })
    },
    [finePointer]
  )

  const lensSpan = 100 / ZOOM
  const lensLeft = Math.min(100 - lensSpan, Math.max(0, pct.x - lensSpan / 2))
  const lensTop = Math.min(100 - lensSpan, Math.max(0, pct.y - lensSpan / 2))

  const zoomBg = displaySrc ? `url(${JSON.stringify(displaySrc)})` : undefined

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full max-w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:overflow-visible",
        className
      )}
    >
      <div className="relative min-w-0">
        <div
          ref={heroRef}
          className={cn(
            "relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-zinc-50 sm:aspect-square dark:bg-zinc-900/80",
            finePointer && pointerInHero && !zoomEngaged && "ring-1 ring-inset ring-violet-400/25 dark:ring-violet-500/20",
            frameClassName
          )}
          onPointerEnter={() => setPointerInHero(true)}
          onPointerLeave={() => {
            setPointerInHero(false)
            setZoomEngaged(false)
          }}
          onPointerMove={finePointer ? onMove : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote listing URLs; absolute fill avoids iOS flex max-h-full collapse */}
          <img
            key={displaySrc}
            src={displaySrc}
            alt={alt}
            draggable={false}
            decoding="async"
            className="absolute inset-0 h-full w-full select-none object-contain object-center p-3 sm:p-4"
            onError={() => {
              setDisplaySrc((current) =>
                current === PLACEHOLDER_SRC ? current : PLACEHOLDER_SRC
              )
            }}
          />
          {zoomActive ? (
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
          {finePointer && pointerInHero && !zoomEngaged ? (
            <p
              className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1.5 text-center text-[11px] font-medium text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-600/80 dark:bg-zinc-950/85 dark:text-zinc-300"
              aria-live="polite"
            >
              Hover image to zoom
            </p>
          ) : null}
          {overlay ? <div className="pointer-events-none absolute inset-0 z-[3]">{overlay}</div> : null}
        </div>
      </div>

      {finePointer ? (
        <div
          role="region"
          aria-label={zoomActive ? "Magnified product image" : "Product image zoom"}
          aria-hidden={!zoomActive}
          className={cn(
            "pointer-events-none absolute z-40 hidden overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] transition-[opacity,transform] duration-200 ease-out dark:border-zinc-600 dark:bg-zinc-900/95 lg:block",
            "left-[calc(100%+0.75rem)] top-0 h-full min-h-[12rem] w-56 xl:w-64",
            zoomActive ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
          )}
        >
          <div
            className="absolute inset-0 bg-no-repeat transition-[background-position] duration-75 ease-out"
            style={{
              backgroundImage: zoomBg,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${ZOOM * 100}% auto`,
              backgroundPosition: `${pct.x}% ${pct.y}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
