"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import type { BattleProductCard } from "@/lib/pulse/battle-types"

type Props = {
  product: BattleProductCard
  votes: number
  pct: number
  side: "A" | "B"
  isWinner: boolean
  voted: boolean
  disabled: boolean
  detailsHref?: string | null
  onVote: () => void
}

function money(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  })
}

/**
 * Half-screen contender card with video backdrop + vote CTA.
 */
export function BattleProductCard({
  product,
  votes,
  pct,
  side,
  isWinner,
  voted,
  disabled,
  detailsHref = null,
  onVote,
}: Props) {
  const leading = pct >= 50

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden border-white/10",
        side === "A" ? "border-r" : "border-l",
        isWinner && "ring-2 ring-inset ring-emerald-400"
      )}
      data-testid={`battle-card-${side}`}
    >
      {product.videoUrl ? (
        <video
          src={product.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}
      <div className="absolute inset-0 bg-black/55" aria-hidden />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        {isWinner ? (
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
            Gagnant −20%
          </span>
        ) : null}
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt=""
            className="h-28 w-28 rounded-2xl object-cover shadow-2xl ring-1 ring-white/20 sm:h-40 sm:w-40"
          />
        ) : null}
        <h2 className="max-w-[90%] text-sm font-bold leading-snug text-white sm:text-lg">
          {product.name}
        </h2>
        <p className="text-white/70">{money(product.priceCents)}</p>
        <p className="text-[10px] uppercase tracking-wider text-white/40">{product.category}</p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={disabled || voted}
            onClick={onVote}
            className={cn(
              "h-12 min-w-[9rem] rounded-full px-6 text-sm font-black transition active:scale-[0.98] disabled:opacity-60",
              voted
                ? "bg-emerald-500 text-black"
                : "bg-white text-black hover:bg-zinc-100"
            )}
          >
            {voted ? "Voté ✓" : "VOTER"}
          </button>
          {detailsHref ? (
            <Link
              href={detailsHref}
              className="inline-flex h-12 min-w-[9rem] items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Détails
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 px-3 pb-3">
        <div className="mb-1 flex justify-between text-[10px] font-semibold text-white/70">
          <span>
            {votes} vote{votes === 1 ? "" : "s"}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              leading ? "bg-emerald-400" : "bg-white/40"
            )}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
