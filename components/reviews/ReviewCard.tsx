"use client"

import { motion } from "framer-motion"
import { BadgeCheck, Share2, ThumbsDown, ThumbsUp } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import { Lightbox } from "@/components/reviews/Lightbox"
import { StarRating } from "@/components/reviews/StarRating"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { ReviewListItem } from "@/lib/reviews/types"
import { formatStoreDate } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  review: ReviewListItem
  onVote?: (reviewId: string, type: "HELPFUL" | "UNHELPFUL") => Promise<void>
  index?: number
}

export function ReviewCard({ review, onVote, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount)
  const [voting, setVoting] = useState(false)

  const name = review.user?.name ?? review.author ?? "Verified buyer"
  const avatar = review.user?.image
  const media = review.media
  const showReadMore = review.body.length > 280

  async function vote(type: "HELPFUL" | "UNHELPFUL") {
    if (!onVote || voting) return
    setVoting(true)
    capturePosthogClient("review_helpful_click", { reviewId: review.id, type })
    try {
      await onVote(review.id, type)
      if (type === "HELPFUL") setHelpfulCount((c) => c + (review.myVote === "HELPFUL" ? 0 : 1))
    } finally {
      setVoting(false)
    }
  }

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.24) }}
        className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 backdrop-blur-xl transition-all hover:border-purple-500/30 dark:from-zinc-900/80 dark:to-zinc-950/60"
      >
        <header className="flex items-start gap-3">
          {avatar ? (
            <Image src={avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
              {review.verified ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Verified
                </span>
              ) : null}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatStoreDate(review.publishedAt ?? review.createdAt)}
              {review.user?.totalReviews ? ` · ${review.user.totalReviews} reviews` : null}
            </p>
          </div>
          <StarRating value={review.rating} size="sm" />
        </header>

        {review.title ? (
          <h4 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{review.title}</h4>
        ) : null}

        {media.length > 0 ? (
          <div
            className={cn(
              "mt-4 grid gap-2",
              media.length === 1 ? "grid-cols-1" : media.length === 2 ? "grid-cols-2" : "grid-cols-3"
            )}
          >
            {media.slice(0, 3).map((m, i) => (
              <button
                key={`${m.url}-${i}`}
                type="button"
                className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-white/10"
                onClick={() => {
                  setLightboxIndex(i)
                  setLightbox(true)
                  if (m.type === "video") capturePosthogClient("review_media_play", { reviewId: review.id })
                }}
              >
                {m.type === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <Image
                    src={m.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="120px"
                    unoptimized={m.url.startsWith("http")}
                  />
                )}
              </button>
            ))}
          </div>
        ) : null}

        <p
          className={cn(
            "mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300/90",
            !expanded && showReadMore && "line-clamp-4"
          )}
        >
          {review.body}
        </p>
        {showReadMore ? (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}

        {review.reply ? (
          <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Creator reply</p>
            <p className="mt-1">{review.reply.body}</p>
          </div>
        ) : null}

        <footer className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/5 pt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Helpful?</span>
          <button
            type="button"
            disabled={voting}
            onClick={() => void vote("HELPFUL")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium transition hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400",
              review.myVote === "HELPFUL" && "text-emerald-600 dark:text-emerald-400"
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
            Yes ({helpfulCount})
          </button>
          <button
            type="button"
            disabled={voting}
            onClick={() => void vote("UNHELPFUL")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium transition hover:bg-zinc-500/10"
          >
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
            No
          </button>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:text-violet-600 dark:hover:text-violet-400"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title: "Affisell review", text: review.body.slice(0, 200) })
              }
            }}
            aria-label="Share review"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </footer>
      </motion.article>

      <Lightbox
        open={lightbox}
        onClose={() => setLightbox(false)}
        items={media}
        startIndex={lightboxIndex}
        author={name}
        caption={review.title ?? undefined}
      />
    </>
  )
}
