"use client"

import { Heart } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  subscribeWishlistStatus,
  type WishlistCardStatus,
} from "@/lib/wishlist-status-batch"
import { toggleProductWishlist } from "@/lib/wishlist-toggle-client"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  className?: string
  ariaLabelAdd?: string
  ariaLabelRemove?: string
}

function formatLikeCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(n)
}

export function WishlistHeart({
  productId,
  className,
  ariaLabelAdd,
  ariaLabelRemove,
}: Props) {
  const t = useTranslations("wishlist.heart")
  const [wished, setWished] = useState(false)
  const [dropPercent, setDropPercent] = useState(0)
  const [likeCount, setLikeCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const apply = (status: WishlistCardStatus) => {
      setWished(status.wished)
      setDropPercent(status.dropPercent)
      setLikeCount(status.likeCount)
    }
    return subscribeWishlistStatus(productId, apply)
  }, [productId])

  async function toggle() {
    if (busy) return
    setBusy(true)
    const prevWished = wished
    const prevCount = likeCount
    try {
      const result = await toggleProductWishlist(productId)
      if (!result.ok) {
        console.error("[wishlist-heart]", { productId, error: result.error })
        return
      }
      const nextWished = result.wished
      setWished(nextWished)
      if (typeof result.likeCount === "number") {
        setLikeCount(Math.max(0, result.likeCount))
      } else {
        setLikeCount(
          Math.max(
            0,
            prevCount + (nextWished && !prevWished ? 1 : !nextWished && prevWished ? -1 : 0)
          )
        )
      }
      if (!nextWished) setDropPercent(0)
    } finally {
      setBusy(false)
    }
  }

  const showCount = likeCount > 0

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        aria-label={wished ? ariaLabelRemove ?? t("remove") : ariaLabelAdd ?? t("add")}
        aria-pressed={wished}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void toggle()
        }}
        disabled={busy}
        className={cn(
          "inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1.5 shadow-md backdrop-blur-md transition-all duration-200 active:scale-95",
          wished
            ? "bg-rose-500/95 text-white ring-2 ring-rose-300/60"
            : "bg-white/92 text-zinc-700 ring-1 ring-black/8 hover:bg-white dark:bg-zinc-900/88 dark:text-zinc-200 dark:ring-white/10"
        )}
      >
        <Heart
          className={cn(
            "size-4 shrink-0 transition-colors duration-200",
            wished ? "fill-white text-white" : "fill-transparent text-zinc-600 dark:text-zinc-300"
          )}
          aria-hidden
        />
        {showCount ? (
          <span
            className={cn(
              "min-w-[1ch] text-xs font-bold tabular-nums leading-none",
              wished ? "text-white" : "text-zinc-800 dark:text-zinc-100"
            )}
            aria-label={t("count", { count: likeCount })}
          >
            {formatLikeCount(likeCount)}
          </span>
        ) : null}
      </button>
      {wished && dropPercent > 0 ? (
        <p className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          🔔 -{dropPercent}% {t("dropSinceYesterday")}
        </p>
      ) : null}
    </div>
  )
}
