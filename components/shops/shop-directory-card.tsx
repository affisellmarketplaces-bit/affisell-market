"use client"

import type { CSSProperties } from "react"
import { FastLink } from "@/components/navigation/fast-link"
import { ArrowRight, Euro, ShoppingBag, Star } from "lucide-react"
import { useTranslations } from "next-intl"

import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"
import { cn } from "@/lib/utils"

const DEFAULT_ACCENT = "#7c3aed"
const DEFAULT_PRIMARY = "#18181b"

function ShopDirectoryName({ shop }: { shop: PublicShopDirectoryEntry }) {
  const accent = shop.themeAccent ?? DEFAULT_ACCENT
  const primary = shop.themePrimary ?? DEFAULT_PRIMARY
  const badgeStyle = shop.nameBadge ?? "classic"

  if (badgeStyle !== "classic") {
    return (
      <div className="max-w-full overflow-hidden py-0.5">
        <StoreNameBadge
          name={shop.name}
          style={badgeStyle}
          accent={accent}
          primary={primary}
          size="preview"
          className="max-w-full origin-left"
        />
      </div>
    )
  }

  return (
    <p className="truncate text-base font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
      <span
        className="bg-clip-text text-transparent"
        style={{
          backgroundImage: `linear-gradient(105deg, ${primary} 0%, ${accent} 72%)`,
        }}
      >
        {shop.name}
      </span>
    </p>
  )
}

export function ShopDirectoryCard({ shop }: { shop: PublicShopDirectoryEntry }) {
  const t = useTranslations("discovery")
  const tShops = useTranslations("shops")
  const accent = shop.themeAccent ?? DEFAULT_ACCENT
  const rating = shop.averageRating > 0 ? shop.averageRating.toFixed(1) : null
  const ordersLabel = tShops("ordersCount", { count: shop.orderCount })
  const startingPrice =
    shop.startingPriceCents != null && shop.startingPriceCents > 0
      ? formatStoreCurrencyFromCents(shop.startingPriceCents, { maximumFractionDigits: 0 })
      : null
  const href = `/shops/${shop.slug}`

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-900/50"
      style={{ "--shop-accent": accent } as CSSProperties}
    >
      <div
        className="h-14 shrink-0 bg-gradient-to-br opacity-90"
        style={{
          backgroundImage: `linear-gradient(125deg, color-mix(in srgb, ${accent} 28%, transparent), color-mix(in srgb, ${accent} 8%, transparent) 55%, transparent)`,
        }}
        aria-hidden
      />

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="-mt-7 mb-3 flex items-end gap-3">
          {shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- creator CDN hosts
            <img
              src={shop.logoUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-2xl border-2 border-white object-cover shadow-md ring-1 ring-zinc-200/80 dark:border-zinc-900 dark:ring-zinc-700"
              loading="lazy"
            />
          ) : (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-white text-lg font-bold text-white shadow-md ring-1 ring-zinc-200/80 dark:border-zinc-900 dark:ring-zinc-700"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              {shop.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 pb-0.5">
            <ShopDirectoryName shop={shop} />
          </div>
        </div>

        <span className="mb-3 inline-flex w-fit rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {t(`niches.${shop.nicheLabel}`)}
        </span>

        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          {startingPrice ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <Euro className="size-3.5" aria-hidden />
                {tShops("startingPrice", { price: startingPrice })}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
            </>
          ) : null}
          <span className="inline-flex items-center gap-1 font-medium">
            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {rating ?? "—"}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <ShoppingBag className="size-3.5 text-violet-500" aria-hidden />
            {ordersLabel}
          </span>
        </div>

        <FastLink
          href={href}
          className={cn(
            "mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition",
            "bg-[var(--shop-accent)] hover:brightness-110 active:scale-[0.99]",
            "group-hover:shadow-md group-hover:shadow-violet-500/20"
          )}
        >
          {tShops("visitStore")}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </FastLink>
      </div>
    </article>
  )
}
