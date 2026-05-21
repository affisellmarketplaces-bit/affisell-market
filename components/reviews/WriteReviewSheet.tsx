"use client"

import confetti from "canvas-confetti"
import { Sparkles, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { UploadDropzone } from "@/lib/uploadthing"
import { StarRating } from "@/components/reviews/StarRating"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { ReviewMediaItem } from "@/lib/reviews/types"
import { cn } from "@/lib/utils"

const QUICK_TAGS = ["Quality", "Shipping", "Value", "Packaging", "Size"] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  orderId: string
  productName: string
  initialRating?: number
  onSubmitted?: () => void
}

export function WriteReviewSheet({
  open,
  onOpenChange,
  productId,
  orderId,
  productName,
  initialRating = 0,
  onSubmitted,
}: Props) {
  const t = useTranslations("reviews.write")
  const [rating, setRating] = useState(initialRating)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [media, setMedia] = useState<ReviewMediaItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setRating(initialRating || 0)
      setError(null)
    }
  }, [open, initialRating])

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]))
    setBody((b) => (b.includes(tag) ? b : b ? `${b} · ${tag}` : tag))
  }

  const improveWithAi = useCallback(async () => {
    if (body.trim().length < 10) return
    setAiLoading(true)
    try {
      const res = await fetch("/api/reviews/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, title, tags }),
      })
      const data = (await res.json()) as { body?: string; title?: string }
      if (data.body) setBody(data.body)
      if (data.title) setTitle(data.title)
    } catch {
      setError(t("aiError"))
    } finally {
      setAiLoading(false)
    }
  }, [body, title, tags, t])

  async function submit() {
    if (rating < 1) {
      setError(t("ratingRequired"))
      return
    }
    if (body.trim().length < 20) {
      setError(t("bodyMin"))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productId,
          orderId,
          rating,
          title: title.trim() || null,
          body: body.trim(),
          media,
        }),
      })
      const data = (await res.json()) as { error?: string; review?: { status: string } }
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t("submitError"))

      if (rating === 5) {
        void confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })
      }
      capturePosthogClient("review_submitted", { rating, hasMedia: media.length > 0 })
      onSubmitted?.()
      onOpenChange(false)
      setBody("")
      setTitle("")
      setMedia([])
      setRating(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("submitError"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col overflow-y-auto border-zinc-800 bg-zinc-950/95 p-0 text-zinc-50">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/90 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">{t("eyebrow")}</p>
              <h2 className="text-lg font-bold">{t("title")}</h2>
              <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{productName}</p>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-5 py-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <StarRating value={rating} onChange={setRating} size="xl" />
            <p className="text-sm text-zinc-400">{t("tapStars")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    tags.includes(tag)
                      ? "border-violet-500/50 bg-violet-500/20 text-violet-200"
                      : "border-white/10 text-zinc-400 hover:border-white/20"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("headline")}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={t("headlinePlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none ring-violet-500/0 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/25"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("experience")}</label>
              <button
                type="button"
                disabled={aiLoading || body.length < 10}
                onClick={() => void improveWithAi()}
                className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {aiLoading ? t("aiLoading") : t("aiImprove")}
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={t("bodyPlaceholder")}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/25"
            />
            <p className="text-right text-[11px] text-zinc-500">{body.length}/2000</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("photosVideos")}</p>
            <UploadDropzone
              endpoint="reviewMedia"
              onClientUploadComplete={(files) => {
                const next: ReviewMediaItem[] = files.map((f) => ({
                  type: (f.type?.startsWith("video") || f.name?.endsWith(".mp4") ? "video" : "image") as "image" | "video",
                  url: f.url,
                }))
                setMedia((m) => [...m, ...next].slice(0, 6))
              }}
              onUploadError={(e) => setError(e.message)}
              className="ut-label:hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4"
            />
            {media.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {media.map((m, i) => (
                  <li key={m.url} className="relative">
                    {m.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-800 text-[10px] text-zinc-400">
                        Video
                      </span>
                    )}
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 rounded-full bg-zinc-900 p-0.5 ring-1 ring-white/20"
                      onClick={() => setMedia((arr) => arr.filter((_, j) => j !== i))}
                      aria-label={t("removeMedia")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <Button
            type="button"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 py-6 text-base font-semibold"
            onClick={() => void submit()}
          >
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
