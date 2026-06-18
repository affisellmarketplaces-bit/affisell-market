"use client"

import { motion } from "framer-motion"
import { Film, Maximize2, Play } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"

import { ProductVideoWishlistOverlay } from "@/components/product/product-video-wishlist-overlay"
import { isUsableProductImageUrl } from "@/lib/product-image-url"
import { cn } from "@/lib/utils"

const PLACEHOLDER = "/placeholder-product.jpg"

function comparableSlideUrl(url: string): string {
  const t = url.trim()
  if (t.startsWith("data:")) return t.toLowerCase()
  return t.split("?")[0]?.toLowerCase() ?? ""
}

export type MobileProductGalleryCarouselProps = {
  images: string[]
  activeIndex: number
  onSelectIndex: (index: number) => void
  /** When set, overrides the active slide image (e.g. per-color hero not at gallery index). */
  heroSrc?: string
  videoUrl?: string | null
  productId?: string
  alt: string
  overlay?: ReactNode
  onOpenLightbox: (index: number) => void
  onVideoActive?: () => void
  onImageActive?: () => void
  className?: string
}

type Slide =
  | { kind: "image"; url: string; index: number }
  | { kind: "video" }

export function MobileProductGalleryCarousel({
  images,
  activeIndex,
  onSelectIndex,
  heroSrc,
  videoUrl,
  productId,
  alt,
  overlay,
  onOpenLightbox,
  onVideoActive,
  onImageActive,
  className,
}: MobileProductGalleryCarouselProps) {
  const t = useTranslations("Product.gallery")
  const scrollRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLElement | null)[]>([])
  const [scrollIndex, setScrollIndex] = useState(0)
  const syncingFromParent = useRef(false)

  const safeImages = images.length > 0 ? images : [PLACEHOLDER]
  const hasVideo = Boolean(videoUrl?.trim())

  const slides = useMemo((): Slide[] => {
    const items: Slide[] = safeImages.map((url, index) => ({
      kind: "image",
      url,
      index,
    }))
    if (hasVideo) items.push({ kind: "video" })
    return items
  }, [hasVideo, safeImages])

  const totalSlides = slides.length
  const currentSlide = slides[scrollIndex] ?? slides[0]
  const isVideoSlide = currentSlide?.kind === "video"

  const scrollToSlide = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const el = slideRefs.current[index]
    if (!el) return
    syncingFromParent.current = true
    el.scrollIntoView({ behavior, inline: "center", block: "nearest" })
    window.setTimeout(() => {
      syncingFromParent.current = false
    }, 400)
  }, [])

  useEffect(() => {
    if (activeIndex < 0) {
      if (hasVideo) scrollToSlide(safeImages.length, "auto")
      return
    }
    const target = Math.min(activeIndex, safeImages.length - 1)
    if (target !== scrollIndex || isVideoSlide) {
      scrollToSlide(target, "auto")
    }
  }, [activeIndex, hasVideo, isVideoSlide, safeImages.length, scrollIndex, scrollToSlide])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || totalSlides <= 1) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (syncingFromParent.current) return
        let best = -1
        let bestRatio = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = Number((entry.target as HTMLElement).dataset.slideIndex)
          if (Number.isNaN(idx)) continue
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            best = idx
          }
        }
        if (best < 0 || best === scrollIndex) return
        setScrollIndex(best)
        const slide = slides[best]
        if (slide?.kind === "video") {
          onVideoActive?.()
        } else if (slide?.kind === "image") {
          onImageActive?.()
          onSelectIndex(slide.index)
        }
      },
      { root, threshold: [0.55, 0.72, 0.9] }
    )

    slideRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [onImageActive, onSelectIndex, onVideoActive, scrollIndex, slides, totalSlides])

  const displayCounter = isVideoSlide
    ? t("video")
    : t("slideCounter", {
        current: (currentSlide?.kind === "image" ? currentSlide.index : 0) + 1,
        total: safeImages.length,
      })

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={scrollRef}
        className="affisell-mobile-gallery-track flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label={t("thumbRail")}
      >
        {slides.map((slide, i) => (
          <article
            key={slide.kind === "video" ? "video" : `img-${slide.index}`}
            ref={(node) => {
              slideRefs.current[i] = node
            }}
            data-slide-index={i}
            className="relative w-full shrink-0 snap-center snap-always"
            aria-hidden={i !== scrollIndex}
          >
            <div className="relative aspect-[5/6] max-h-[min(42dvh,22rem)] w-full overflow-hidden rounded-2xl border border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white shadow-[0_20px_50px_-28px_rgba(91,33,217,0.35)] dark:border-zinc-700/80 dark:from-zinc-900 dark:to-zinc-950 sm:max-h-[min(44dvh,24rem)]">
              {slide.kind === "video" ? (
                <ProductVideoWishlistOverlay productId={productId ?? ""} className="h-full w-full">
                  <video
                    src={videoUrl!}
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex items-center gap-1.5 bg-gradient-to-b from-black/55 to-transparent px-3 py-2.5 pr-14">
                    <Film className="size-3.5 text-white/90" aria-hidden />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/95">
                      {t("video")}
                    </p>
                  </div>
                </ProductVideoWishlistOverlay>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      i === scrollIndex &&
                      heroSrc?.trim() &&
                      isUsableProductImageUrl(heroSrc) &&
                      comparableSlideUrl(heroSrc) !== comparableSlideUrl(slide.url)
                        ? heroSrc
                        : slide.url
                    }
                    alt={alt}
                    className="h-full w-full touch-pan-y object-contain p-2"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER
                    }}
                  />
                  {i === scrollIndex && !isVideoSlide ? overlay : null}
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-3 flex items-start justify-between px-3">
        <span className="rounded-full border border-white/25 bg-zinc-900/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-md">
          {displayCounter}
        </span>
        {!isVideoSlide && currentSlide?.kind === "image" ? (
          <button
            type="button"
            onClick={() => onOpenLightbox(currentSlide.index)}
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white shadow-lg backdrop-blur-md active:scale-95"
            aria-label={t("fullView")}
          >
            <Maximize2 className="size-4" aria-hidden />
          </button>
        ) : isVideoSlide ? (
          <span className="flex items-center gap-1 rounded-full border border-white/25 bg-violet-600/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            <Play className="size-3 fill-current" aria-hidden />
            {t("video")}
          </span>
        ) : null}
      </div>

      {totalSlides > 1 ? (
        <div
          className="mt-3 flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label={t("thumbRail")}
        >
          {slides.map((slide, i) => {
            const active = i === scrollIndex
            return (
              <button
                key={slide.kind === "video" ? "dot-video" : `dot-${slide.index}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={
                  slide.kind === "video"
                    ? t("playVideo")
                    : t("goToSlide", { index: slide.index + 1 })
                }
                onClick={() => scrollToSlide(i)}
                className="flex h-8 min-w-8 items-center justify-center rounded-full p-1"
              >
                <motion.span
                  layout
                  className={cn(
                    "block h-1.5 rounded-full transition-colors",
                    active
                      ? "w-6 bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      : "w-1.5 bg-zinc-300 dark:bg-zinc-600"
                  )}
                />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
