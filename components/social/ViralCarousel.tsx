"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

import type { ViralMedia } from "@/types/product"
import { cn } from "@/lib/utils"

type Props = {
  medias: ViralMedia[]
  autoPlay?: boolean
  className?: string
  /** rounded-full for bubble; rounded-2xl for asset cards */
  shape?: "circle" | "rect"
}

/**
 * Viral Assets V2 — cinematic auto carousel (Ken Burns on images, fade on video).
 * 1 media → static; 2+ → auto-advance.
 */
export function ViralCarousel({
  medias,
  autoPlay = true,
  className,
  shape = "rect",
}: Props) {
  const safe = medias.filter((m) => Boolean(m?.url))
  const count = safe.length
  const firstUrl = safe[0]?.url ?? ""
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [count, firstUrl])

  useEffect(() => {
    if (!autoPlay || count < 2) return
    const current = safe[index]
    if (!current) return
    const duration =
      current.type === "video" ? (current.duration ?? 3000) : (current.duration ?? 1200)
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % count)
    }, duration)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance on index + media identity
  }, [index, count, firstUrl, autoPlay])

  if (safe.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-zinc-900 text-2xl text-white/40",
          shape === "circle" ? "rounded-full" : "rounded-2xl",
          className
        )}
      >
        🫧
      </div>
    )
  }

  if (safe.length === 1) {
    const only = safe[0]!
    return (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden",
          shape === "circle" ? "rounded-full" : "rounded-2xl",
          className
        )}
      >
        {only.type === "video" ? (
          <video
            src={only.url}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic product CDN
          <img src={only.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
    )
  }

  const current = safe[index]!

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        shape === "circle" ? "rounded-full" : "rounded-2xl",
        className
      )}
    >
      <AnimatePresence mode="wait">
        {current.type === "image" ? (
          <motion.img
            key={`img-${index}-${current.url}`}
            src={current.url}
            alt=""
            initial={{ scale: 1.12, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <motion.video
            key={`vid-${index}-${current.url}`}
            src={current.url}
            autoPlay
            muted
            loop
            playsInline
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </AnimatePresence>

      <div
        className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1"
        aria-hidden
      >
        {safe.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === index ? "w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "w-1 bg-white/35"
            )}
          />
        ))}
      </div>
    </div>
  )
}
