"use client"

import { Film, Maximize2, Play } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"

import { MobileProductGalleryCarousel } from "@/components/product/mobile-product-gallery-carousel"
import { ProductGalleryLightbox } from "@/components/product/product-gallery-lightbox"
import { ProductImageHoverZoom } from "@/components/product-image-hover-zoom"
import { isDirectMp4Url } from "@/lib/product-description-video-embed"
import { cn } from "@/lib/utils"

const MAX_DESKTOP_THUMBS = 5
const PLACEHOLDER = "/placeholder-product.jpg"

export type ProductMediaGalleryProps = {
  images: string[]
  heroSrc: string
  activeThumbIndex: number
  onSelectImage: (index: number) => void
  videoUrl?: string | null
  alt: string
  overlay?: ReactNode
  className?: string
}

type ThumbItem =
  | { kind: "image"; url: string; index: number }
  | { kind: "more"; url: string; index: number; extraCount: number }
  | { kind: "video" }

function comparableUrl(u: string) {
  return u.trim().split("?")[0]?.toLowerCase() ?? ""
}

export function ProductMediaGallery({
  images,
  heroSrc,
  activeThumbIndex,
  onSelectImage,
  videoUrl,
  alt,
  overlay,
  className,
}: ProductMediaGalleryProps) {
  const t = useTranslations("Product.gallery")
  const [mediaMode, setMediaMode] = useState<"image" | "video">("image")
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const hasVideo = Boolean(videoUrl?.trim() && isDirectMp4Url(videoUrl))
  const safeImages = images.length > 0 ? images : [PLACEHOLDER]

  const desktopThumbs = useMemo((): ThumbItem[] => {
    const items: ThumbItem[] = []
    if (safeImages.length <= MAX_DESKTOP_THUMBS) {
      safeImages.forEach((url, index) => items.push({ kind: "image", url, index }))
    } else {
      const shown = MAX_DESKTOP_THUMBS - 1
      safeImages.slice(0, shown).forEach((url, index) => {
        items.push({ kind: "image", url, index })
      })
      items.push({
        kind: "more",
        url: safeImages[shown]!,
        index: shown,
        extraCount: safeImages.length - shown,
      })
    }
    if (hasVideo) items.push({ kind: "video" })
    return items
  }, [safeImages, hasVideo])

  useEffect(() => {
    if (mediaMode === "video" && !hasVideo) setMediaMode("image")
  }, [hasVideo, mediaMode])

  useEffect(() => {
    setMediaMode("image")
  }, [heroSrc])

  const selectImage = useCallback(
    (index: number) => {
      setMediaMode("image")
      onSelectImage(index)
    },
    [onSelectImage]
  )

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(Math.min(Math.max(0, index), safeImages.length - 1))
    setLightboxOpen(true)
  }, [safeImages.length])

  const handleLightboxIndexChange = useCallback(
    (i: number) => {
      setLightboxIndex(i)
      setMediaMode("image")
      onSelectImage(i)
    },
    [onSelectImage]
  )

  const isThumbActive = (index: number) =>
    mediaMode === "image" && activeThumbIndex >= 0 && activeThumbIndex === index

  const thumbButtonClass = (active: boolean) =>
    cn(
      "relative aspect-square w-full overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 dark:bg-zinc-950",
      active
        ? "border-sky-500 shadow-md ring-2 ring-sky-400/30 dark:border-sky-400"
        : "border-zinc-200/90 opacity-90 hover:border-zinc-300 hover:opacity-100 dark:border-zinc-700 dark:hover:border-zinc-500"
    )

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2 sm:gap-3 lg:flex-row lg:gap-4 lg:overflow-visible",
          className
        )}
      >
        {/* Desktop vertical rail */}
        <div
          className="hidden shrink-0 flex-col gap-2 lg:flex lg:w-[4.75rem] xl:w-[5.25rem]"
          role="tablist"
          aria-label={t("thumbRail")}
        >
          {desktopThumbs.map((item, i) => {
            if (item.kind === "video") {
              const active = mediaMode === "video"
              return (
                <button
                  key="video"
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={t("playVideo")}
                  onClick={() => setMediaMode("video")}
                  className={cn(
                    thumbButtonClass(active),
                    "flex flex-col items-center justify-center gap-0.5 bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-800 dark:to-zinc-900"
                  )}
                >
                  <Film className="size-5 text-zinc-600 dark:text-zinc-300" aria-hidden />
                  <Play className="absolute size-7 rounded-full bg-white/90 p-1.5 text-zinc-900 shadow-md dark:bg-zinc-950/90 dark:text-white" aria-hidden />
                  <span className="relative z-[1] mt-6 text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
                    {t("video")}
                  </span>
                </button>
              )
            }
            if (item.kind === "more") {
              const active = isThumbActive(item.index)
              return (
                <button
                  key={`more-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    selectImage(item.index)
                    openLightbox(item.index)
                  }}
                  className={thumbButtonClass(active)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="h-full w-full object-contain p-1.5 opacity-80" />
                  <span className="absolute inset-0 flex items-center justify-center bg-zinc-900/55 text-sm font-bold text-white backdrop-blur-[2px]">
                    {t("more", { count: item.extraCount })}
                  </span>
                </button>
              )
            }
            const active = isThumbActive(item.index)
            return (
              <button
                key={`img-${item.index}`}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectImage(item.index)}
                className={thumbButtonClass(active)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-contain p-1.5"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER
                  }}
                />
              </button>
            )
          })}
        </div>

        {/* Main stage */}
        <div className="min-w-0 flex-1 space-y-2 lg:overflow-visible">
          <div className="lg:hidden">
            <MobileProductGalleryCarousel
              images={safeImages}
              activeIndex={mediaMode === "video" ? -1 : activeThumbIndex}
              onSelectIndex={selectImage}
              videoUrl={hasVideo ? videoUrl : null}
              alt={alt}
              overlay={overlay}
              onOpenLightbox={openLightbox}
              onVideoActive={() => setMediaMode("video")}
              onImageActive={() => setMediaMode("image")}
              className="-mx-1 sm:mx-0"
            />
          </div>

          <div className="relative hidden overflow-visible rounded-[1.35rem] lg:block">
            {mediaMode === "video" && hasVideo ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.35rem] bg-zinc-950">
                <video
                  src={videoUrl!}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  autoPlay
                  preload="metadata"
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
                    {t("video")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative z-10 overflow-visible">
                <ProductImageHoverZoom
                  src={heroSrc}
                  alt={alt}
                  overlay={overlay}
                  className="overflow-visible rounded-[1.35rem] border-zinc-200/55 bg-white/90 shadow-[0_28px_70px_-34px_rgba(91,33,217,0.28)] ring-1 ring-violet-500/[0.07] dark:border-zinc-700/80 dark:bg-zinc-950/70"
                  frameClassName="rounded-[1.1rem] aspect-[4/3] bg-gradient-to-b from-zinc-50/95 to-white dark:from-zinc-900/90 dark:to-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => openLightbox(activeThumbIndex >= 0 ? activeThumbIndex : 0)}
                  className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-sky-800 shadow-sm backdrop-blur-sm transition hover:bg-sky-50 dark:border-sky-800/60 dark:bg-zinc-950/90 dark:text-sky-200 dark:hover:bg-sky-950/50"
                >
                  <Maximize2 className="size-3.5 shrink-0" aria-hidden />
                  {t("fullView")}
                </button>
              </div>
            )}
          </div>

          <p className="hidden text-center text-[11px] text-zinc-500 lg:block dark:text-zinc-400">
            {t("desktopHint")}
          </p>
        </div>
      </div>

      <ProductGalleryLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={safeImages}
        index={lightboxIndex}
        onIndexChange={handleLightboxIndexChange}
        alt={alt}
      />
    </>
  )
}

export { comparableUrl as comparableGalleryImageUrl }
