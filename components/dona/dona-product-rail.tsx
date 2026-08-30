"use client"

import Link from "next/link"
import { ArrowUpRight, TrendingUp } from "lucide-react"

import type { DonaProductHit, DonaProductToolResult } from "@/lib/dona/dona-product-types"
import { formatStoreCurrency } from "@/lib/market-config"
import { cn } from "@/lib/utils"

function rankStyles(rank: number | undefined): string {
  if (rank === 1) return "from-amber-400 via-orange-500 to-fuchsia-600 shadow-amber-500/30"
  if (rank === 2) return "from-violet-300 via-indigo-500 to-sky-500 shadow-violet-500/25"
  if (rank === 3) return "from-violet-400/90 via-indigo-600 to-blue-600 shadow-indigo-500/20"
  return "from-white/30 via-violet-600/80 to-indigo-700 shadow-violet-900/20"
}

function DonaProductRailCard({ product }: { product: DonaProductHit }) {
  const rank = product.rank
  const isTop = rank === 1

  return (
    <Link
      href={product.url}
      className={cn(
        "group relative flex gap-3 overflow-hidden rounded-xl border p-2.5 transition duration-300",
        isTop
          ? "border-amber-300/35 bg-gradient-to-br from-amber-500/10 via-[#161636] to-fuchsia-950/40 hover:border-amber-200/50"
          : "border-white/10 bg-[#12122e] hover:border-violet-500/40 hover:bg-[#161636]"
      )}
    >
      {isTop ? (
        <div
          className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-amber-400/20 blur-2xl"
          aria-hidden
        />
      ) : null}
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[#0E0E2C] ring-1 ring-white/10">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote supplier URLs in chat widget
          <img src={product.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-white/30">—</div>
        )}
        {rank != null ? (
          <span
            className={cn(
              "absolute left-1 top-1 inline-flex min-w-[1.35rem] items-center justify-center rounded-md bg-gradient-to-br px-1 py-0.5 text-[10px] font-black text-white shadow-md",
              rankStyles(rank)
            )}
          >
            #{rank}
          </span>
        ) : null}
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-semibold text-white">{product.name}</p>
        <p className="mt-0.5 truncate text-[10px] text-white/50">{product.brand}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-bold", isTop ? "text-amber-100" : "text-violet-200")}>
            {formatStoreCurrency(product.price)}
          </p>
          {product.soldCount != null && product.soldCount > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/55">
              {product.soldCount} vendus · 7j
            </span>
          ) : null}
        </div>
      </div>
      <ArrowUpRight className="size-4 shrink-0 self-center text-white/30 transition group-hover:text-violet-200" />
    </Link>
  )
}

export function DonaProductRail({
  data,
  mode = "search",
}: {
  data: DonaProductToolResult
  mode?: "search" | "bestsellers"
}) {
  const hasProducts = data.products.length > 0 || data.similarProducts.length > 0
  if (!hasProducts) return null

  const isBestsellers = mode === "bestsellers" || data.products.some((p) => p.rank != null)

  return (
    <div className="mt-3 space-y-2.5">
      {isBestsellers ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/90">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Live · 7 jours
          </p>
          {data.hubUrl ? (
            <Link
              href={data.hubUrl}
              className="text-[10px] font-semibold text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline"
            >
              Classement complet
            </Link>
          ) : null}
        </div>
      ) : null}

      {data.products.map((p) => (
        <DonaProductRailCard key={p.listingId} product={p} />
      ))}

      {data.similarProducts.length > 0 ? (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/70">Similaires</p>
          {data.similarProducts.map((p) => (
            <DonaProductRailCard key={p.listingId} product={p} />
          ))}
        </div>
      ) : null}

      {data.hubUrl && isBestsellers ? (
        <Link
          href={data.hubUrl}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/15 px-3 py-2.5 text-xs font-bold text-violet-100 transition hover:border-violet-300/40 hover:from-violet-600/30"
        >
          <TrendingUp className="size-3.5 shrink-0 text-amber-300" aria-hidden />
          Voir le top complet
          <ArrowUpRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}
