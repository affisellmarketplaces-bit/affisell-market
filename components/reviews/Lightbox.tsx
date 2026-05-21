"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"

import type { ReviewMediaItem } from "@/lib/reviews/types"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  items: ReviewMediaItem[]
  startIndex?: number
  caption?: string
  author?: string
}

export function Lightbox({ open, onClose, items, startIndex = 0, caption, author }: Props) {
  const [index, setIndex] = useState(startIndex)

  useEffect(() => {
    if (open) setIndex(startIndex)
  }, [open, startIndex])

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => (i + dir + items.length) % items.length)
    },
    [items.length]
  )

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

  const current = items[index]
  if (!current) return null

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          aria-label="Media lightbox"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white md:left-6"
                onClick={() => go(-1)}
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white md:right-6"
                onClick={() => go(1)}
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}
          <motion.div
            key={index}
            className="relative max-h-[80vh] w-full max-w-3xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
          >
            {current.type === "video" ? (
              <video
                src={current.url}
                className="mx-auto max-h-[80vh] w-full rounded-2xl"
                controls
                playsInline
                muted
                loop
              />
            ) : (
              <div className="relative mx-auto aspect-[4/5] max-h-[80vh] w-full max-w-lg">
                <Image
                  src={current.url}
                  alt=""
                  fill
                  className="rounded-2xl object-contain"
                  sizes="(max-width: 768px) 100vw, 512px"
                  unoptimized={current.url.startsWith("http")}
                />
              </div>
            )}
            {(author || caption) && (
              <p className="mt-4 text-center text-sm text-white/80">
                {author ? <span className="font-semibold text-white">{author}</span> : null}
                {author && caption ? " · " : null}
                {caption}
              </p>
            )}
          </motion.div>
          <p className={cn("absolute bottom-4 text-xs text-white/50")}>
            {index + 1} / {items.length}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
