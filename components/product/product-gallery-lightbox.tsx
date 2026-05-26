"use client"

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion"
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const PLACEHOLDER = "/placeholder-product.jpg"
const MIN_SCALE = 1
const MAX_SCALE = 4
const DISMISS_DRAG_Y = 110
const DISMISS_VELOCITY_Y = 650

type ProductGalleryLightboxProps = {
  open: boolean
  onClose: () => void
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  alt: string
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function ZoomableSlide({
  src,
  alt,
  active,
  reduceMotion,
}: {
  src: string
  alt: string
  active: boolean
  reduceMotion: boolean | null
}) {
  const t = useTranslations("Product.gallery")
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!active) {
      setScale(1)
      setOffset({ x: 0, y: 0 })
      pinchStart.current = null
      dragStart.current = null
    }
  }, [active, src])

  const resetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const toggleZoom = useCallback(() => {
    setScale((s) => {
      if (s > 1) {
        setOffset({ x: 0, y: 0 })
        return 1
      }
      return 2.5
    })
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || !active) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      setScale((s) => {
        const next = clamp(s + delta, MIN_SCALE, MAX_SCALE)
        if (next <= 1) setOffset({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [active])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scale <= 1 || e.pointerType === "touch") return
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || scale <= 1) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setOffset({
      x: dragStart.current.ox + dx,
      y: dragStart.current.oy + dy,
    })
  }

  const onPointerUp = () => {
    dragStart.current = null
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0]!, e.touches[1]!]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchStart.current = { dist, scale }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchStart.current) return
    const [a, b] = [e.touches[0]!, e.touches[1]!]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const ratio = dist / pinchStart.current.dist
    const next = clamp(pinchStart.current.scale * ratio, MIN_SCALE, MAX_SCALE)
    setScale(next)
    if (next <= 1) setOffset({ x: 0, y: 0 })
  }

  const onTouchEnd = () => {
    pinchStart.current = null
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex h-full w-full items-center justify-center",
        scale > 1 ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-zoom-in"
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={toggleZoom}
      role="presentation"
    >
      <motion.div
        className="relative flex max-h-full max-w-full items-center justify-center"
        animate={
          reduceMotion
            ? undefined
            : { scale, x: offset.x, y: offset.y }
        }
        style={reduceMotion ? { scale, x: offset.x, y: offset.y } : undefined}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[min(88dvh,920px)] max-w-[min(96vw,1100px)] select-none object-contain"
          style={{
            filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.45))",
          }}
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER
          }}
        />
      </motion.div>
      {scale > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            resetZoom()
          }}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md"
        >
          <ZoomOut className="size-3.5" aria-hidden />
          {t("resetZoom")}
        </button>
      ) : (
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[10px] font-medium text-white/70 backdrop-blur-sm md:hidden">
          {t("zoomHint")}
        </p>
      )}
    </div>
  )
}

export function ProductGalleryLightbox({
  open,
  onClose,
  images,
  index,
  onIndexChange,
  alt,
}: ProductGalleryLightboxProps) {
  const t = useTranslations("Product.gallery")
  const reduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const dismissY = useMotionValue(0)
  const backdropOpacity = useTransform(dismissY, [0, 220], [1, 0.35])
  const contentScale = useTransform(dismissY, [0, 220], [1, 0.94])

  const total = images.length
  const safeIndex = total > 0 ? clamp(index, 0, total - 1) : 0
  const indexRef = useRef(safeIndex)
  indexRef.current = safeIndex

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    dismissY.set(0)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, dismissY])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (total <= 1) return
      onIndexChange((safeIndex + dir + total) % total)
    },
    [onIndexChange, safeIndex, total]
  )

  const scrollToIndex = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = trackRef.current?.children[i] as HTMLElement | undefined
      el?.scrollIntoView({ behavior, inline: "center", block: "nearest" })
    },
    []
  )

  useEffect(() => {
    if (!open) return
    scrollToIndex(safeIndex, "auto")
  }, [open, safeIndex, scrollToIndex])

  useEffect(() => {
    const thumb = thumbRefs.current[safeIndex]
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [safeIndex, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") go(-1)
      if (e.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, go])

  useEffect(() => {
    const root = trackRef.current
    if (!open || !root || total <= 1) return

    const observer = new IntersectionObserver(
      (entries) => {
        let best = -1
        let bestRatio = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = Number((entry.target as HTMLElement).dataset.index)
          if (Number.isNaN(idx)) continue
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            best = idx
          }
        }
        if (best >= 0 && best !== indexRef.current) onIndexChange(best)
      },
      { root, threshold: [0.6, 0.85] }
    )

    Array.from(root.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [open, onIndexChange, total])

  const handleDismissDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_DRAG_Y || info.velocity.y > DISMISS_VELOCITY_Y) {
      onClose()
      return
    }
    dismissY.set(0)
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          aria-label={t("lightbox")}
        >
          <motion.button
            type="button"
            aria-label={t("close")}
            className="absolute inset-0 bg-zinc-950"
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
            initial={false}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.22),transparent_55%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(217,70,239,0.12),transparent_50%)]"
            aria-hidden
          />

          <motion.div
            className="relative z-10 flex min-h-0 flex-1 flex-col"
            style={{ y: dismissY, scale: contentScale }}
          >
            {/* Top chrome — swipe down here to dismiss */}
            <motion.div
              className="flex shrink-0 cursor-grab flex-col gap-2 px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))] active:cursor-grabbing sm:px-5"
              drag="y"
              dragConstraints={{ top: 0, bottom: 240 }}
              dragElastic={0.15}
              onDrag={(_, info) => dismissY.set(Math.max(0, info.offset.y))}
              onDragEnd={handleDismissDragEnd}
            >
              {total > 1 ? (
                <div className="flex gap-1 px-1" role="tablist" aria-label={t("lightboxProgress")}>
                  {images.map((_, i) => (
                    <button
                      key={`seg-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={i === safeIndex}
                      onClick={() => {
                        onIndexChange(i)
                        scrollToIndex(i)
                      }}
                      className="group flex-1 py-1"
                    >
                      <span
                        className={cn(
                          "block h-0.5 rounded-full transition-all duration-300",
                          i === safeIndex
                            ? "bg-gradient-to-r from-violet-400 to-fuchsia-400 shadow-[0_0_12px_rgba(167,139,250,0.8)]"
                            : "bg-white/25 group-hover:bg-white/45"
                        )}
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold tabular-nums text-white shadow-lg backdrop-blur-xl">
                  <ZoomIn className="size-4 text-violet-300" aria-hidden />
                  <span>
                    {t("slideCounter", { current: safeIndex + 1, total })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="affisell-touch-target flex items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-xl transition hover:bg-white/20 active:scale-95"
                  aria-label={t("close")}
                >
                  <X className="size-5" />
                </button>
              </div>
              <p className="text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 md:hidden">
                {t("swipeToClose")}
              </p>
            </motion.div>

            {/* Main track */}
            <div className="relative min-h-0 flex-1">
              {total > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-3 text-white backdrop-blur-md transition hover:bg-white/15 md:flex lg:left-5"
                    onClick={() => go(-1)}
                    aria-label={t("prev")}
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-3 text-white backdrop-blur-md transition hover:bg-white/15 md:flex lg:right-5"
                    onClick={() => go(1)}
                    aria-label={t("next")}
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              ) : null}

              <div
                ref={trackRef}
                className="affisell-lightbox-track flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {images.map((url, i) => (
                  <div
                    key={`lb-slide-${i}`}
                    data-index={i}
                    className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-2 sm:px-6"
                  >
                    <ZoomableSlide
                      src={url}
                      alt={alt}
                      active={i === safeIndex}
                      reduceMotion={reduceMotion}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Filmstrip */}
            {total > 1 ? (
              <div className="shrink-0 border-t border-white/10 bg-gradient-to-t from-black/80 to-transparent px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
                <div
                  className="flex gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="tablist"
                  aria-label={t("thumbRail")}
                >
                  {images.map((url, i) => {
                    const active = i === safeIndex
                    return (
                      <button
                        key={`lb-thumb-${i}`}
                        ref={(el) => {
                          thumbRefs.current[i] = el
                        }}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          onIndexChange(i)
                          scrollToIndex(i)
                        }}
                        className={cn(
                          "relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 sm:h-16 sm:w-16",
                          active
                            ? "scale-105 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.45)] ring-2 ring-violet-400/40"
                            : "border-white/15 opacity-65 hover:opacity-100"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full bg-zinc-900 object-contain p-1"
                          loading="lazy"
                        />
                        {active ? (
                          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-violet-400 to-fuchsia-400" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[max(0.85rem,env(safe-area-inset-bottom))]" />
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
