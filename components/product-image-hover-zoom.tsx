"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"

import {
  computeObjectContainRect,
  parsePaddingPx,
  pointerPercentInContainedImage,
  type ContainedImageRect,
} from "@/lib/product-image-zoom-bounds"
import { cn } from "@/lib/utils"

const ZOOM = 2.75

const PLACEHOLDER_SRC = "/placeholder-product.jpg"

type Props = {
  src: string
  alt: string
  overlay?: ReactNode
  className?: string
  frameClassName?: string
}

type PointerPct = { x: number; y: number }

/**
 * Desktop: loupe + zoom pane overlaid on the gallery (layout never shrinks — no jitter).
 */
export function ProductImageHoverZoom({ src, alt, overlay, className, frameClassName }: Props) {
  const t = useTranslations("Product.gallery")
  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const zoomPaneRef = useRef<HTMLDivElement>(null)
  const zoomImgRef = useRef<HTMLImageElement>(null)
  const imageRectRef = useRef<ContainedImageRect | null>(null)
  const pctRef = useRef<PointerPct>({ x: 50, y: 50 })
  const rafRef = useRef(0)

  const [pointerInHero, setPointerInHero] = useState(false)
  const [zoomEngaged, setZoomEngaged] = useState(false)
  const [finePointer, setFinePointer] = useState(false)
  const [displaySrc, setDisplaySrc] = useState(src)
  const [hasImageRect, setHasImageRect] = useState(false)

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
    pctRef.current = { x: 50, y: 50 }
    imageRectRef.current = null
    setHasImageRect(false)
  }, [src])

  const applyLensAndZoom = useCallback(() => {
    const rect = imageRectRef.current
    const lens = lensRef.current
    const zoomImg = zoomImgRef.current
    const pane = zoomPaneRef.current
    if (!rect || !lens || !zoomImg || !pane) return

    const { x, y } = pctRef.current
    const lensW = rect.width / ZOOM
    const lensH = rect.height / ZOOM
    const cx = rect.left + (x / 100) * rect.width
    const cy = rect.top + (y / 100) * rect.height
    const lensLeft = Math.min(
      rect.left + rect.width - lensW,
      Math.max(rect.left, cx - lensW / 2)
    )
    const lensTop = Math.min(
      rect.top + rect.height - lensH,
      Math.max(rect.top, cy - lensH / 2)
    )

    lens.style.width = `${lensW}px`
    lens.style.height = `${lensH}px`
    lens.style.transform = `translate3d(${lensLeft}px, ${lensTop}px, 0)`

    const zw = rect.width * ZOOM
    const zh = rect.height * ZOOM
    zoomImg.style.width = `${zw}px`
    zoomImg.style.height = `${zh}px`

    const paneW = pane.clientWidth
    const paneH = pane.clientHeight
    const tx = paneW * 0.5 - (x / 100) * zw
    const ty = paneH * 0.5 - (y / 100) * zh
    zoomImg.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
  }, [])

  const scheduleApply = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      applyLensAndZoom()
    })
  }, [applyLensAndZoom])

  const measureImageRect = useCallback(() => {
    const hero = heroRef.current
    const img = imgRef.current
    if (!hero || !img) return

    const nw = img.naturalWidth
    const nh = img.naturalHeight
    if (!nw || !nh) {
      imageRectRef.current = null
      setHasImageRect(false)
      return
    }

    const pad = parsePaddingPx(getComputedStyle(img).padding)
    const rect = computeObjectContainRect(hero.clientWidth, hero.clientHeight, nw, nh, pad)
    imageRectRef.current = rect
    setHasImageRect(rect.width > 0)
    scheduleApply()
  }, [scheduleApply])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    measureImageRect()
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(measureImageRect)
    })
    ro.observe(hero)
    return () => ro.disconnect()
  }, [measureImageRect, displaySrc])

  const zoomActive = finePointer && pointerInHero && zoomEngaged && hasImageRect

  useEffect(() => {
    if (!zoomActive) return
    scheduleApply()
  }, [zoomActive, scheduleApply])

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const hero = heroRef.current
      const img = imgRef.current
      if (!hero || !finePointer) return

      const r = hero.getBoundingClientRect()
      const localX = e.clientX - r.left
      const localY = e.clientY - r.top
      const rect =
        imageRectRef.current ??
        computeObjectContainRect(
          hero.clientWidth,
          hero.clientHeight,
          img?.naturalWidth ?? 0,
          img?.naturalHeight ?? 0,
          img ? parsePaddingPx(getComputedStyle(img).padding) : { top: 0, right: 0, bottom: 0, left: 0 }
        )

      const next = pointerPercentInContainedImage(localX, localY, rect)
      if (!next) return

      if (!zoomEngaged) setZoomEngaged(true)
      pctRef.current = next
      scheduleApply()
    },
    [finePointer, scheduleApply, zoomEngaged]
  )

  const onLeave = useCallback(() => {
    setPointerInHero(false)
    setZoomEngaged(false)
    if (lensRef.current) lensRef.current.style.opacity = "0"
  }, [])

  const onEnter = useCallback(() => {
    setPointerInHero(true)
    if (lensRef.current) lensRef.current.style.opacity = "1"
  }, [])

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full max-w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      <div
        ref={heroRef}
        className={cn(
          "relative flex aspect-[4/5] w-full cursor-crosshair items-center justify-center overflow-hidden bg-zinc-50 sm:aspect-square dark:bg-zinc-900/80",
          finePointer && pointerInHero && !zoomEngaged && "ring-1 ring-inset ring-violet-400/30 dark:ring-violet-500/25",
          frameClassName
        )}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onPointerMove={finePointer ? onMove : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          key={displaySrc}
          src={displaySrc}
          alt={alt}
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full select-none object-contain object-center p-3 sm:p-4"
          onLoad={measureImageRect}
          onError={() => {
            setDisplaySrc((current) =>
              current === PLACEHOLDER_SRC ? current : PLACEHOLDER_SRC
            )
          }}
        />

        <div
          ref={lensRef}
          className={cn(
            "pointer-events-none absolute left-0 top-0 z-[1] rounded-sm border-2 border-violet-500/90 bg-violet-400/10 shadow-[0_0_0_1px_rgba(255,255,255,0.85)_inset] will-change-transform dark:border-violet-400/80",
            zoomActive ? "opacity-100" : "opacity-0"
          )}
          aria-hidden
        />

        {finePointer && pointerInHero && !zoomEngaged ? (
          <p
            className="pointer-events-none absolute inset-x-0 bottom-10 z-[2] mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-full border border-zinc-200/80 bg-white/92 px-3 py-1.5 text-center text-[11px] font-medium text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-600/80 dark:bg-zinc-950/90 dark:text-zinc-300"
            aria-live="polite"
          >
            {t("hoverZoomHint")}
          </p>
        ) : null}

        {overlay ? <div className="pointer-events-none absolute inset-0 z-[3]">{overlay}</div> : null}

        {zoomActive ? (
          <div
            ref={zoomPaneRef}
            role="region"
            aria-label="Vue rapprochée du produit"
            className="pointer-events-none absolute inset-y-0 right-0 z-[4] hidden w-[44%] max-w-[280px] overflow-hidden border-l border-zinc-200/90 bg-gradient-to-br from-zinc-50/98 via-white/98 to-violet-50/40 shadow-[-12px_0_32px_-12px_rgba(15,23,42,0.12)] backdrop-blur-[2px] dark:border-zinc-700 dark:from-zinc-900/98 dark:via-zinc-950/98 dark:to-violet-950/30 lg:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={zoomImgRef}
              src={displaySrc}
              alt=""
              draggable={false}
              aria-hidden
              className="absolute left-0 top-0 max-w-none select-none will-change-transform"
            />
            <div
              className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[size:14px_14px] opacity-50"
              aria-hidden
            />
            <p className="absolute bottom-2 left-2 right-2 rounded-md bg-black/45 px-2 py-1 text-center text-[10px] font-medium tracking-wide text-white/95">
              {t("zoomDetailLevel", { level: Math.round(ZOOM * 100) })}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
