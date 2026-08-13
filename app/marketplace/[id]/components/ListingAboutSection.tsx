"use client"

import { ChevronDown, FileText } from "lucide-react"
import { motion } from "framer-motion"
import { DescriptionRichContent } from "@/components/product/description-rich-content"
import { formatStoreCount } from "@/lib/market-config"
import { cn } from "@/lib/utils"
import { DescriptionIllustrativeMedia } from "../listing-detail-media"
import { t } from "../listing-detail-utils"

type Props = {
  reduceMotion: boolean | null
  description: string
  descriptionBullets: string[]
  descriptionIllustrationImages: string[]
  descriptionGalleryImages: string[]
  descriptionIllustrationVideos: string[]
  productId: string
  glanceText: string | null
  descriptionIsLong: boolean
  descExpanded: boolean
  onToggleDescExpanded: () => void
  reviewCount: number
  productT: { reviews: string }
}

export function ListingAboutSection({
  reduceMotion,
  description,
  descriptionBullets,
  descriptionIllustrationImages,
  descriptionGalleryImages,
  descriptionIllustrationVideos,
  productId,
  glanceText,
  descriptionIsLong,
  descExpanded,
  onToggleDescExpanded,
  reviewCount,
  productT,
}: Props) {
  return (
    <motion.div
      className="order-4 flex min-w-0 flex-col gap-6 lg:order-none lg:col-span-7 lg:row-start-3"
      initial={reduceMotion ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        aria-hidden
        className="hidden h-px w-full bg-gradient-to-r from-transparent via-zinc-200/90 to-transparent dark:via-zinc-700/80 lg:block"
      />

      <motion.div
        id="product-description"
        initial={reduceMotion ? false : { y: 12 }}
        animate={{ y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/80 p-4 shadow-sm sm:p-6 dark:border-zinc-700/80 dark:from-zinc-900/90 dark:to-zinc-950/80"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent dark:via-violet-500/25"
          aria-hidden
        />
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">About this product</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Full copy from the listing · specs below</p>
          </div>
        </div>
        {glanceText ? (
          <blockquote className="mt-5 border-l-4 border-violet-500/60 bg-violet-50/50 py-3 pl-4 pr-3 text-sm italic leading-relaxed text-zinc-800 dark:border-violet-500/40 dark:bg-violet-950/25 dark:text-zinc-200">
            {glanceText}
          </blockquote>
        ) : null}
        {descriptionBullets.length > 0 ? (
          <div className={glanceText ? "mt-6" : "mt-5"}>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              Highlights
            </p>
            <ul className="mt-3 list-none space-y-2.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {descriptionBullets.map((line, i) => (
                <li key={`hero-bullet-${i}`} className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm shadow-violet-500/30"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={descriptionBullets.length > 0 ? "mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800" : "mt-5"}>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Full detail</p>
          <div
            className={cn(
              "relative mt-3",
              !descExpanded && descriptionIsLong && "max-h-[min(420px,55vh)] overflow-hidden"
            )}
          >
            <DescriptionRichContent description={description} images={descriptionIllustrationImages} />
            {!descExpanded && descriptionIsLong ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-zinc-900 dark:via-zinc-900/90"
                aria-hidden
              />
            ) : null}
          </div>
          {descriptionIsLong ? (
            <button
              type="button"
              onClick={onToggleDescExpanded}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/30"
            >
              {descExpanded ? "Show less" : "Show full description"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${descExpanded ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          ) : null}
          <DescriptionIllustrativeMedia
            productId={productId}
            images={descriptionGalleryImages}
            videos={descriptionIllustrationVideos}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
          <a
            href="#listing-specs"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
          >
            Technical specs
          </a>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <a
            href="#listing-reviews"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
          >
            {t(productT.reviews, { count: formatStoreCount(reviewCount) })}
          </a>
        </div>
      </motion.div>
    </motion.div>
  )
}
