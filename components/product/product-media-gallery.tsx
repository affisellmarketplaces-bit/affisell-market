"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Film, Maximize2, Play, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"

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

  const lightboxGo = useCallback(
    (dir: -1 | 1) => {
      setLightboxIndex((i) => (i + dir + safeImages.length) % safeImages.length)
    },
    [safeImages.length]
  )

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false)
      if (e.key === "ArrowLeft") lightboxGo(-1)
      if (e.key === "ArrowRight") lightboxGo(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightboxOpen, lightboxGo])

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
          <div className="relative max-lg:overflow-hidden max-lg:rounded-xl lg:overflow-visible lg:rounded-[1.35rem]">
            {mediaMode === "video" && hasVideo ? (
              <div className="relative aspect-square w-full overflow-hidden bg-zinc-950 lg:aspect-[4/3]">
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
              <div className="relative lg:z-10 lg:overflow-visible">
                <ProductImageHoverZoom
                  src={heroSrc}
                  alt={alt}
                  overlay={overlay}
                  className="max-lg:rounded-xl max-lg:border-zinc-200/80 max-lg:shadow-sm lg:overflow-visible lg:rounded-[1.35rem] lg:border-zinc-200/55 lg:bg-white/90 lg:shadow-[0_28px_70px_-34px_rgba(91,33,217,0.28)] lg:ring-1 lg:ring-violet-500/[0.07] dark:max-lg:border-zinc-700/80 dark:lg:border-zinc-700/80 dark:lg:bg-zinc-950/70"
                  frameClassName="max-lg:rounded-xl max-lg:aspect-square lg:rounded-[1.1rem] lg:aspect-[4/3] lg:bg-gradient-to-b lg:from-zinc-50/95 lg:to-white dark:lg:from-zinc-900/90 dark:lg:to-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => openLightbox(activeThumbIndex >= 0 ? activeThumbIndex : 0)}
                  className="pointer-events-auto absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-sky-800 shadow-sm backdrop-blur-sm transition hover:bg-sky-50 dark:border-sky-800/60 dark:bg-zinc-950/90 dark:text-sky-200 dark:hover:bg-sky-950/50 lg:bottom-4 lg:left-4"
                >
                  <Maximize2 className="size-3.5 shrink-0" aria-hidden />
                  {t("fullView")}
                </button>
              </div>
            )}
          </div>

          {/* Mobile + tablet horizontal rail */}
          <div
            className="flex w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:thin] lg:hidden"
            role="tablist"
            aria-label={t("thumbRail")}
          >
            {safeImages.slice(0, 12).map((url, i) => (
              <button
                key={`m-${i}`}
                type="button"
                role="tab"
                aria-selected={isThumbActive(i)}
                onClick={() => selectImage(i)}
                className={cn(
                  "relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 sm:w-[4.5rem]",
                  isThumbActive(i)
                    ? "border-sky-500 ring-2 ring-sky-400/25"
                    : "border-zinc-200 dark:border-zinc-700"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
              </button>
            ))}
            {hasVideo ? (
              <button
                type="button"
                role="tab"
                aria-selected={mediaMode === "video"}
                onClick={() => setMediaMode("video")}
                className={cn(
                  "relative flex aspect-square w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 bg-zinc-100 dark:bg-zinc-800 sm:w-[4.5rem]",
                  mediaMode === "video"
                    ? "border-sky-500 ring-2 ring-sky-400/25"
                    : "border-zinc-200 dark:border-zinc-700"
                )}
              >
                <Play className="size-6 text-zinc-700 dark:text-zinc-200" aria-hidden />
                <span className="mt-1 text-[8px] font-bold uppercase">{t("video")}</span>
              </button>
            ) : null}
          </div>

          <p className="hidden text-center text-[11px] text-zinc-500 lg:block dark:text-zinc-400">
            {t("desktopHint")}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {lightboxOpen ? (
          <motion.div
            className="fixed inset-0 z-[90] flex flex-col bg-zinc-950/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal
            aria-label={t("lightbox")}
          >
            <div className="flex items-center justify-between px-4 py-3 text-white">
              <span className="text-sm font-medium tabular-nums">
                {lightboxIndex + 1} / {safeImages.length}
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                aria-label={t("close")}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-8">
              {safeImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 md:left-6"
                    onClick={() => lightboxGo(-1)}
                    aria-label={t("prev")}
                  >
                    <ChevronLeft className="size-6 text-white" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 md:right-6"
                    onClick={() => lightboxGo(1)}
                    aria-label={t("next")}
                  >
                    <ChevronRight className="size-6 text-white" />
                  </button>
                </>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeImages[lightboxIndex]}
                alt={alt}
                className="max-h-[min(78vh,900px)] max-w-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER
                }}
              />
            </div>
            <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-6">
              {safeImages.map((url, i) => (
                <button
                  key={`lb-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className={cn(
                    "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2",
                    i === lightboxIndex ? "border-sky-400" : "border-white/20 opacity-70"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export { comparableUrl as comparableGalleryImageUrl }
