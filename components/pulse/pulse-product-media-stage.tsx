"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Maximize2 } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"

import { ProductGalleryLightbox } from "@/components/product/product-gallery-lightbox"
import { affisellBrand } from "@/lib/affisell-brand"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import {
  pulseMediaStartIndex,
  resolvePulseMediaSlides,
} from "@/lib/pulse-media-gallery"
import { cn } from "@/lib/utils"

type Props = {
  item: PulseFeedItem
  /** Top / visible card — videos play only when true. */
  active?: boolean
  /** When false, video audio can play (scroll mode). Default muted for swipe. */
  muted?: boolean
  /** Skip fade-in on first paint (swipe top card). */
  instantReveal?: boolean
  /** Photo lightbox (pinch / double-tap). Default true. */
  enablePhotoZoom?: boolean
  /** Notify parent (e.g. pause Framer drag while lightbox is open). */
  onLightboxOpenChange?: (open: boolean) => void
  className?: string
  onTapAdvance?: () => void
}

export function PulseProductMediaStage({
  item,
  active = true,
  muted = true,
  instantReveal = false,
  enablePhotoZoom = true,
  onLightboxOpenChange,
  className,
}: Props) {
  const tGallery = useTranslations("Product.gallery")
  const slides = useMemo(() => resolvePulseMediaSlides(item), [item])
  const startIndex = useMemo(
    () => pulseMediaStartIndex(slides, item.mediaUrl),
    [slides, item.mediaUrl]
  )
  const [index, setIndex] = useState(startIndex)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const onLightboxOpenChangeRef = useRef(onLightboxOpenChange)
  onLightboxOpenChangeRef.current = onLightboxOpenChange

  const photoUrls = useMemo(
    () =>
      slides
        .filter((s) => !s.isVideo)
        .map((s) => s.url)
        .filter((url) => url.trim().length > 0 && !broken[url]),
    [slides, broken]
  )

  useEffect(() => {
    setIndex(startIndex)
    setBroken({})
    setLightboxOpen(false)
  }, [item.id, startIndex])

  useEffect(() => {
    onLightboxOpenChangeRef.current?.(lightboxOpen)
  }, [lightboxOpen])

  useEffect(() => {
    if (!active && lightboxOpen) setLightboxOpen(false)
  }, [active, lightboxOpen])

  const current = slides[index] ?? slides[0]
  const hasMultiple = slides.length > 1
  const currentBroken = Boolean(current && broken[current.url])
  const fallbackSrc = "/placeholder.png"

  useEffect(() => {
    const el = videoRef.current
    if (!el || !current?.isVideo) return
    el.muted = muted
    if (active) {
      void el.play().catch(() => {})
    } else {
      el.pause()
      el.currentTime = 0
    }
  }, [active, current?.url, current?.isVideo, muted])

  function advance() {
    if (!hasMultiple) return
    setIndex((i) => (i + 1) % slides.length)
  }

  function handleMediaTap(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    advance()
  }

  function openLightbox(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    e.preventDefault()
    if (!enablePhotoZoom || photoUrls.length === 0) return
    const currentUrl = current && !current.isVideo ? current.url : null
    const photoIdx = currentUrl
      ? Math.max(0, photoUrls.findIndex((u) => u === currentUrl))
      : 0
    setLightboxIndex(photoIdx >= 0 ? photoIdx : 0)
    setLightboxOpen(true)
    console.log("[pulse-zoom]", { listingId: item.listingId, result: "open" })
  }

  const showAsVideo = Boolean(current?.isVideo && !currentBroken)
  const isPhoto = !showAsVideo
  const displayUrl =
    currentBroken || !current
      ? fallbackSrc
      : current.url
  const canZoom = enablePhotoZoom && isPhoto && photoUrls.length > 0

  if (!current) {
    return (
      <div className={cn("flex h-full items-center justify-center bg-white text-zinc-400", className)}>
        —
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden",
        isPhoto ? "bg-white" : "bg-zinc-950",
        className
      )}
      role={hasMultiple ? "button" : undefined}
      tabIndex={hasMultiple ? 0 : undefined}
      aria-label={hasMultiple ? `Media ${index + 1} of ${slides.length}` : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          advance()
        }
      }}
    >
      <div className="absolute inset-0" aria-hidden>
        {showAsVideo ? (
          <video
            key={`bg-${current!.url}`}
            src={current!.url}
            className="h-full w-full scale-105 object-cover opacity-40 blur-xl"
            muted={muted}
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-white" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`bg-${displayUrl}`}
              src={displayUrl}
              alt=""
              className="h-full w-full scale-110 object-contain opacity-[0.14] blur-2xl"
            />
          </>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={displayUrl}
          className={cn(
            "relative z-[1] flex h-full w-full items-center justify-center",
            isPhoto ? "p-1.5 sm:p-2" : "p-3"
          )}
          initial={instantReveal ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: instantReveal ? 0.08 : 0.14 }}
        >
          {showAsVideo ? (
            <video
              ref={videoRef}
              key={current!.url}
              src={current!.url}
              className="pointer-events-none max-h-full max-w-full object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
              muted={muted}
              loop
              playsInline
              autoPlay={active}
              preload={active ? "auto" : "metadata"}
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noplaybackrate"
              onError={() => {
                if (!current) return
                setBroken((prev) => ({ ...prev, [current.url]: true }))
                if (hasMultiple) setIndex((i) => (i + 1) % slides.length)
              }}
            />
          ) : displayUrl.startsWith("http") || displayUrl.startsWith("/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt=""
              className="pointer-events-none h-full w-full object-contain object-center"
              onError={() => {
                if (!current) return
                if (displayUrl === fallbackSrc) return
                setBroken((prev) => ({ ...prev, [current.url]: true }))
                if (hasMultiple) setIndex((i) => (i + 1) % slides.length)
              }}
            />
          ) : (
            <Image
              src={displayUrl}
              alt=""
              width={512}
              height={512}
              className="pointer-events-none h-full w-full object-contain object-center"
              sizes="(max-width: 420px) 100vw, 380px"
              unoptimized
              onError={() => {
                if (!current) return
                setBroken((prev) => ({ ...prev, [current.url]: true }))
              }}
            />
          )}

          {hasMultiple ? (
            <button
              type="button"
              className="absolute inset-0 z-10 cursor-pointer border-0 bg-transparent p-0"
              aria-label={`Media ${index + 1} of ${slides.length}, tap for next`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleMediaTap}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isPhoto
            ? "bg-gradient-to-b from-white/0 via-white/0 to-zinc-200/50"
            : "bg-gradient-to-b from-black/40 via-transparent to-black/75"
        )}
        aria-hidden
      />

      {canZoom ? (
        <button
          type="button"
          data-testid="pulse-photo-zoom"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={openLightbox}
          className={cn(
            "absolute right-2 top-2 z-30 flex size-9 items-center justify-center rounded-full",
            "border border-white/35 bg-zinc-950/55 text-white shadow-[0_8px_24px_rgb(2_6_23_/_0.45)]",
            "backdrop-blur-md transition active:scale-95",
            "hover:border-cyan-300/50 hover:bg-zinc-950/70 hover:shadow-[0_0_20px_rgb(34_211_238_/_0.25)]",
            "sm:right-3 sm:top-3 sm:size-10"
          )}
          aria-label={tGallery("fullView")}
          title={tGallery("tapToZoom")}
        >
          <Maximize2 className="size-4 sm:size-[1.125rem]" aria-hidden />
        </button>
      ) : null}

      {hasMultiple ? (
        <div
          className={cn(
            affisellBrand.epoxyChip,
            "pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-semibold tabular-nums sm:bottom-3 sm:px-2.5 sm:py-1 sm:text-[10px]",
            isPhoto
              ? "bg-zinc-900/75 text-white ring-1 ring-black/10"
              : "text-white/90"
          )}
        >
          {index + 1}/{slides.length}
        </div>
      ) : null}

      {enablePhotoZoom && photoUrls.length > 0 ? (
        <ProductGalleryLightbox
          open={lightboxOpen}
          onClose={() => {
            setLightboxOpen(false)
            console.log("[pulse-zoom]", { listingId: item.listingId, result: "close" })
          }}
          images={photoUrls}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          alt={item.title}
          className="z-[320]"
        />
      ) : null}
    </div>
  )
}
