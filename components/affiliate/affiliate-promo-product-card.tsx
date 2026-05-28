"use client"

import Image from "next/image"
import { Check, Store } from "lucide-react"

import { VerifiedBadge } from "@/components/suppliers/verified-badge"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { primaryProductImage } from "@/lib/product-images"
import { cn } from "@/lib/utils"

export type AffiliatePromoProductCardProps = {
  name: string
  imageUrl?: string | null
  images?: string[]
  basePriceCents: number
  marginCents: number
  commissionRate: number
  supplierLabel: string
  isVerifiedSupplier?: boolean
  /** Prix de vente suggéré (ex. +30 % markup) — affiché en sous-ligne discrète. */
  sellingPriceCents?: number
  className?: string
  listed?: boolean
  priority?: boolean
}

/**
 * Tuile produit affilié — même langage visuel que le catalogue « à promouvoir ».
 */
export function AffiliatePromoProductCard({
  name,
  imageUrl,
  images,
  basePriceCents,
  marginCents,
  commissionRate,
  supplierLabel,
  isVerifiedSupplier = false,
  sellingPriceCents,
  className,
  listed = false,
  priority = false,
}: AffiliatePromoProductCardProps) {
  const thumb = imageUrl?.trim() || primaryProductImage(images) || "/placeholder-product.jpg"
  const remote = thumb.startsWith("http")

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-3xl border text-left",
        "border-zinc-100/90 bg-white/95 shadow-sm ring-1 ring-zinc-100/80",
        "dark:border-zinc-800 dark:bg-zinc-950/95 dark:ring-zinc-800",
        listed && "ring-2 ring-emerald-500/25",
        className
      )}
    >
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-gradient-to-br from-violet-50/60 via-white to-teal-50/40 dark:from-violet-950/40 dark:via-zinc-950 dark:to-teal-950/25">
        {/* Futuriste : halo doux derrière le packshot */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 45%, rgba(139,92,246,0.12), transparent 70%)",
          }}
        />

        {listed ? (
          <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md shadow-emerald-600/30">
            <Check className="size-3" aria-hidden />
            En vitrine
          </span>
        ) : (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md shadow-violet-600/35">
            + Vitrine
          </span>
        )}

        <Image
          src={thumb}
          alt={name}
          fill
          className="object-contain p-4 transition-transform duration-500 ease-out"
          sizes="(max-width: 640px) 90vw, 384px"
          priority={priority}
          draggable={false}
          unoptimized={remote}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {name}
        </h2>

        <p className="text-xl font-black tabular-nums tracking-tight text-zinc-900 dark:text-white">
          {formatStoreCurrencyFromCents(basePriceCents)}
        </p>

        {sellingPriceCents != null && sellingPriceCents > basePriceCents ? (
          <p className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
            Vente cible{" "}
            <span className="font-bold tabular-nums">
              {formatStoreCurrencyFromCents(sellingPriceCents)}
            </span>
          </p>
        ) : null}

        <ul className="flex flex-wrap gap-1.5">
          <li>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300">
              Marge {formatStoreCurrencyFromCents(marginCents, { maximumFractionDigits: 0 })}
            </span>
          </li>
          <li>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950/80 dark:text-violet-300">
              {commissionRate}%
            </span>
          </li>
        </ul>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            <Store className="size-3 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{supplierLabel}</span>
          </p>
          {isVerifiedSupplier ? <VerifiedBadge className="shrink-0" /> : null}
        </div>
      </div>
    </div>
  )
}
