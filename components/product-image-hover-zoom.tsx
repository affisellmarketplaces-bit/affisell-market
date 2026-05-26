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

/** Magnification factor — higher = closer product detail. */
const ZOOM = 3.15

const PLACEHOLDER_SRC = "/placeholder-product.jpg"

type Props = {
  src: string
  alt: string
  overlay?: ReactNode
  className?: string
  frameClassName?: string
}

/**
 * Desktop (lg+): split-pane loupe — lens tracks the real `object-contain` image;
 * magnified pane stays inside the gallery (no overlap on title / buy box).
 */
export function ProductImageHoverZoom({ src, alt, overlay, className, frameClassName }: Props) {
  const t = useTranslations("Product.gallery")
  const heroRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [pointerInHero, setPointerInHero] = useState(false)
  const [zoomEngaged, setZoomEngaged] = useState(false)
  const [pct, setPct] = useState({ x: 50, y: 50 })
  const [finePointer, setFinePointer] = useState(false)
  const [displaySrc, setDisplaySrc] = useState(src)
  const [imageRect, setImageRect] = useState<ContainedImageRect | null>(null)

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

  const measureImageRect = useCallback(() => {
    const hero = heroRef.current
    const img = imgRef.current
    if (!hero || !img) return

    const nw = img.naturalWidth
    const nh = img.naturalHeight
    if (!nw || !nh) {
      setImageRect(null)
      return
    }

    const pad = parsePaddingPx(getComputedStyle(img).padding)
    setImageRect(
      computeObjectContainRect(hero.clientWidth, hero.clientHeight, nw, nh, pad)
    )
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    measureImageRect()
    const ro = new ResizeObserver(() => measureImageRect())
    ro.observe(hero)
    return () => ro.disconnect()
  }, [measureImageRect, displaySrc])

  const zoomActive = finePointer && pointerInHero && zoomEngaged && imageRect && imageRect.width > 0

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const hero = heroRef.current
      if (!hero || !finePointer) return

      const r = hero.getBoundingClientRect()
      const localX = e.clientX - r.left
      const localY = e.clientY - r.top
      const rect = imageRect ?? computeObjectContainRect(
        hero.clientWidth,
        hero.clientHeight,
        imgRef.current?.naturalWidth ?? 0,
        imgRef.current?.naturalHeight ?? 0,
        imgRef.current
          ? parsePaddingPx(getComputedStyle(imgRef.current).padding)
          : { top: 0, right: 0, bottom: 0, left: 0 }
      )

      const next = pointerPercentInContainedImage(localX, localY, rect)
      if (!next) return

      setZoomEngaged(true)
      setPct(next)
    },
    [finePointer, imageRect]
  )

  const lensW = imageRect ? imageRect.width / ZOOM : 0
  const lensH = imageRect ? imageRect.height / ZOOM : 0
  const lensCenterX = imageRect ? imageRect.left + (pct.x / 100) * imageRect.width : 0
  const lensCenterY = imageRect ? imageRect.top + (pct.y / 100) * imageRect.height : 0
  const lensLeft = imageRect
    ? Math.min(
        imageRect.left + imageRect.width - lensW,
        Math.max(imageRect.left, lensCenterX - lensW / 2)
      )
    : 0
  const lensTop = imageRect
    ? Math.min(
        imageRect.top + imageRect.height - lensH,
        Math.max(imageRect.top, lensCenterY - lensH / 2)
      )
    : 0

  const zoomedW = imageRect ? imageRect.width * ZOOM : 0
  const zoomedH = imageRect ? imageRect.height * ZOOM : 0
  const zoomImgLeft = imageRect ? `calc(50% - ${(pct.x / 100) * zoomedW}px)` : "50%"
  const zoomImgTop = imageRect ? `calc(50% - ${(pct.y / 100) * zoomedH}px)` : "50%"

  return (
    <div
      className={cn(
        "relative w-full max-w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        zoomActive && "lg:flex lg:items-stretch lg:gap-0 lg:overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "relative min-w-0 transition-[flex-basis] duration-200 ease-out",
          zoomActive ? "lg:basis-[58%] lg:shrink-0" : "lg:basis-full"
        )}
      >
        <div
          ref={heroRef}
          className={cn(
            "relative flex aspect-[4/5] w-full cursor-crosshair items-center justify-center overflow-hidden bg-zinc-50 sm:aspect-square dark:bg-zinc-900/80",
            finePointer && pointerInHero && !zoomEngaged && "ring-1 ring-inset ring-violet-400/30 dark:ring-violet-500/25",
            frameClassName
          )}
          onPointerEnter={() => setPointerInHero(true)}
          onPointerLeave={() => {
            setPointerInHero(false)
            setZoomEngaged(false)
          }}
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

          {zoomActive && imageRect ? (
            <div
              className="pointer-events-none absolute z-[1] rounded-sm border-2 border-violet-500/90 bg-violet-400/10 shadow-[0_0_0_1px_rgba(255,255,255,0.85)_inset] backdrop-blur-[1px] dark:border-violet-400/80"
              style={{
                left: lensLeft,
                top: lensTop,
                width: lensW,
                height: lensH,
              }}
              aria-hidden
            />
          ) : null}

          {finePointer && pointerInHero && !zoomEngaged ? (
            <p
              className="pointer-events-none absolute inset-x-0 bottom-10 z-[2] mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-full border border-zinc-200/80 bg-white/92 px-3 py-1.5 text-center text-[11px] font-medium text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-600/80 dark:bg-zinc-950/90 dark:text-zinc-300"
              aria-live="polite"
            >
              {t("hoverZoomHint")}
            </p>
          ) : null}

          {overlay ? <div className="pointer-events-none absolute inset-0 z-[3]">{overlay}</div> : null}
        </div>
      </div>

      {zoomActive && imageRect ? (
        <div
          role="region"
          aria-label="Vue rapprochée du produit"
          className="relative hidden min-h-0 overflow-hidden border-t border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-violet-50/30 dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-950 dark:to-violet-950/20 lg:block lg:basis-[42%] lg:shrink-0 lg:border-l lg:border-t-0"
        >
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt=""
              draggable={false}
              aria-hidden
              className="absolute max-w-none select-none"
              style={{
                width: zoomedW,
                height: zoomedH,
                left: zoomImgLeft,
                top: zoomImgTop,
                willChange: "left, top",
                transition: "left 75ms ease-out, top 75ms ease-out",
              }}
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:14px_14px] opacity-60 dark:opacity-40"
            aria-hidden
          />
          <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-black/45 px-2 py-1 text-center text-[10px] font-medium tracking-wide text-white/95 backdrop-blur-sm">
            {t("zoomDetailLevel", { level: Math.round(ZOOM * 100) })}
          </p>
        </div>
      ) : null}
    </div>
  )
}
