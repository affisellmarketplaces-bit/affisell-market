"use client"

import { motion } from "framer-motion"
import { MessageSquarePlus, Star } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import useSWRInfinite from "swr/infinite"

import { ReviewCard } from "@/components/reviews/ReviewCard"
import { StarRating } from "@/components/reviews/StarRating"
import { WriteReviewSheet } from "@/components/reviews/WriteReviewSheet"
import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { ReviewSort, ReviewsListResponse } from "@/lib/reviews/types"
import { formatStoreCount } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type FilterKey = "all" | "media" | "video" | "five" | "verified"

type Props = {
  productId: string
  productName: string
  listingId: string
  initialSummary: {
    averageRating: number
    reviewCount: number
    ugcCount: number
    distribution: Record<number, number>
  }
  canWriteReview?: boolean
  writeReviewOrderId?: string | null
  openWriteOnMount?: boolean
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json() as Promise<ReviewsListResponse>)

export function ReviewsEngine({
  productId,
  productName,
  initialSummary,
  canWriteReview,
  writeReviewOrderId,
  openWriteOnMount = false,
}: Props) {
  const t = useTranslations("reviews")
  const [sort, setSort] = useState<ReviewSort>("top")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [writeOpen, setWriteOpen] = useState(openWriteOnMount && Boolean(writeReviewOrderId))

  const queryBase = useMemo(() => {
    const p = new URLSearchParams()
    p.set("sort", filter === "media" || filter === "video" ? "with_media" : sort)
    if (filter === "five") p.set("rating", "5")
    if (filter === "verified") p.set("verified", "true")
    return p.toString()
  }, [sort, filter])

  const getKey = (pageIndex: number, prev: ReviewsListResponse | null) => {
    if (prev && !prev.nextCursor) return null
    const cursor = pageIndex > 0 && prev?.nextCursor ? `&cursor=${prev.nextCursor}` : ""
    return `/api/reviews/product/${productId}?${queryBase}${cursor}`
  }

  const { data, size, setSize, isLoading, mutate } = useSWRInfinite<ReviewsListResponse>(getKey, fetcher, {
    revalidateFirstPage: true,
  })

  const summary = data?.[0]?.summary ?? {
    averageRating: initialSummary.averageRating,
    reviewCount: initialSummary.reviewCount,
    ugcCount: initialSummary.ugcCount,
    distribution: initialSummary.distribution,
    aiSummary: null,
  }

  const items = data?.flatMap((p) => p.items) ?? []
  const total = summary.reviewCount
  const distTotal = Object.values(summary.distribution).reduce((a, b) => a + b, 0) || 1

  const onVote = useCallback(
    async (reviewId: string, type: "HELPFUL" | "UNHELPFUL") => {
      await fetch(`/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
      })
      void mutate()
    },
    [mutate]
  )

  const filterPills: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("filters.all") },
    { key: "media", label: t("filters.photos") },
    { key: "five", label: t("filters.fiveStar") },
    { key: "verified", label: t("filters.verified") },
  ]

  return (
    <section id="listing-reviews" className="scroll-mt-28">
      <div className="sticky top-[4.5rem] z-20 -mx-1 mb-6 rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-4 backdrop-blur-xl dark:bg-zinc-950/90">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 ring-1 ring-white/10">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.averageRating.toFixed(1)}</span>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {t("title")} · {formatStoreCount(total)}
              </p>
              <StarRating value={summary.averageRating} size="sm" />
              {summary.ugcCount > 0 ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {t("ugcCount", { count: summary.ugcCount })}
                </p>
              ) : null}
            </div>
          </div>
          {canWriteReview && writeReviewOrderId ? (
            <Button
              type="button"
              className="rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 font-semibold shadow-lg shadow-violet-900/20"
              onClick={() => {
                capturePosthogClient("review_write_click", { productId })
                setWriteOpen(true)
              }}
            >
              <MessageSquarePlus className="mr-2 h-4 w-4" aria-hidden />
              {t("writeReview")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md dark:bg-zinc-900/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t("distribution")}</p>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star] ?? 0
            const pct = Math.round((count / distTotal) * 100)
            return (
              <button
                key={star}
                type="button"
                className="flex w-full items-center gap-2 text-left text-xs hover:opacity-80"
                onClick={() => setFilter(star === 5 ? "five" : "all")}
              >
                <span className="w-8 font-medium text-zinc-700 dark:text-zinc-300">{star}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <span className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-8 text-right text-zinc-500">{pct}%</span>
              </button>
            )
          })}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filterPills.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setFilter(p.key)
                  capturePosthogClient("review_filter_click", { filter: p.key, productId })
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  filter === p.key
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ReviewSort)}
            className="w-full max-w-xs rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            aria-label={t("sortLabel")}
          >
            <option value="top">{t("sort.top")}</option>
            <option value="recent">{t("sort.recent")}</option>
            <option value="rating_desc">{t("sort.rating")}</option>
            <option value="with_media">{t("sort.media")}</option>
          </select>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-zinc-200/80 dark:bg-zinc-800/80" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/80 px-8 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40"
        >
          <Star className="mx-auto h-10 w-10 text-violet-400" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{t("emptyBody")}</p>
        </motion.div>
      ) : (
        <motion.div layout className="grid gap-4 md:grid-cols-2">
          {items.map((review, index) => (
            <ReviewCard key={review.id} review={review} onVote={onVote} index={index} />
          ))}
        </motion.div>
      )}

      {data?.[data.length - 1]?.nextCursor ? (
        <div className="mt-8 flex justify-center">
          <Button type="button" variant="outline" onClick={() => setSize(size + 1)}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}

      {writeReviewOrderId ? (
        <WriteReviewSheet
          open={writeOpen}
          onOpenChange={setWriteOpen}
          productId={productId}
          orderId={writeReviewOrderId}
          productName={productName}
          onSubmitted={() => void mutate()}
        />
      ) : null}
    </section>
  )
}
