"use client"

import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"

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
  className?: string
  onTapAdvance?: () => void
}

export function PulseProductMediaStage({
  item,
  active = true,
  muted = true,
  className,
}: Props) {
  const slides = useMemo(() => resolvePulseMediaSlides(item), [item])
  const startIndex = useMemo(
    () => pulseMediaStartIndex(slides, item.mediaUrl),
    [slides, item.mediaUrl]
  )
  const [index, setIndex] = useState(startIndex)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setIndex(startIndex)
  }, [item.id, startIndex])

  const current = slides[index] ?? slides[0]
  const hasMultiple = slides.length > 1

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

  const isPhoto = Boolean(current && !current.isVideo)

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
        {current.isVideo ? (
          <video
            key={`bg-${current.url}`}
            src={current.url}
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
              key={`bg-${current.url}`}
              src={current.url}
              alt=""
              className="h-full w-full scale-110 object-contain opacity-[0.14] blur-2xl"
            />
          </>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.url}
          className={cn(
            "relative z-[1] flex h-full w-full items-center justify-center",
            isPhoto ? "p-1.5 sm:p-2" : "p-3"
          )}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.22 }}
        >
          {current.isVideo ? (
            <video
              ref={videoRef}
              key={current.url}
              src={current.url}
              className="pointer-events-none max-h-full max-w-full object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
              muted={muted}
              loop
              playsInline
              autoPlay={active}
              preload={active ? "auto" : "metadata"}
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noplaybackrate"
            />
          ) : current.url.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt=""
              className="pointer-events-none h-full w-full object-contain object-center"
            />
          ) : (
            <Image
              src={current.url}
              alt=""
              width={512}
              height={512}
              className="pointer-events-none h-full w-full object-contain object-center"
              sizes="(max-width: 420px) 100vw, 380px"
              unoptimized
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

      {hasMultiple ? (
        <div
          className={cn(
            affisellBrand.epoxyChip,
            "pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums",
            isPhoto
              ? "bg-zinc-900/75 text-white ring-1 ring-black/10"
              : "text-white/90"
          )}
        >
          {index + 1}/{slides.length}
        </div>
      ) : null}
    </div>
  )
}
