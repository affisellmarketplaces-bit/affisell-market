"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeCheck, Flame, Loader2, ShoppingBag, ShieldCheck, Star, Truck, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ProductHighlightChips } from "@/components/product/product-highlight-chips"
import { WishlistHeart } from "@/components/wishlist-heart"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { normalizeListingSalesCount, shouldShowBuyerSalesCount } from "@/lib/listing-sales-count"
import { formatStoreCurrency } from "@/lib/market-config"
import { resolveProductDiscount } from "@/lib/product-discount-display"
import { isShowcasePopular } from "@/lib/product-highlights"
import type { ProductShowcaseData } from "@/lib/product-showcase-types"
import { cn } from "@/lib/utils"

const PLACEHOLDER = "/placeholder-product.jpg"
const MAX_THUMBS = 5

export type { ProductShowcaseData } from "@/lib/product-showcase-types"

type Props = {
  product: ProductShowcaseData
  className?: string
  /** LCP hint when the card is the first thing on the page. */
  imagePriority?: boolean
}

function Stars({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="relative inline-flex" role="img" aria-label={label}>
      <span className="flex text-zinc-200 dark:text-zinc-700" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="size-4 fill-current" />
        ))}
      </span>
      <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-400" style={{ width: `${pct}%` }} aria-hidden>
        <span className="flex w-[5.25rem]">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="size-4 shrink-0 fill-current" />
          ))}
        </span>
      </span>
    </span>
  )
}

/**
 * Immersive product card: photo with live badges, key-benefit chips and a thumbnail rail, rating, a bold price pill
 * with the discount, a one-tap "add to cart", and delivery / warranty reassurance. Everything is optional and
 * degrades gracefully (no reviews → no rating row, no highlights → no chips, …).
 */
export function ProductShowcaseCard({ product, className, imagePriority = false }: Props) {
  const t = useTranslations("productShowcase")
  const tSales = useTranslations("product.sales")
  const tCard = useTranslations("boutique.productCard")

  const images = useMemo(() => {
    const seen = new Set<string>()
    const list = product.images.filter((u) => {
      const k = u.trim().split("?")[0]!.toLowerCase()
      if (!u.trim() || seen.has(k)) return false
      seen.add(k)
      return true
    })
    return list.length > 0 ? list : [PLACEHOLDER]
  }, [product.images])

  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  useEffect(() => setActive(0), [images])
  useEffect(() => {
    if (!added) return
    const id = window.setTimeout(() => setAdded(false), 2200)
    return () => window.clearTimeout(id)
  }, [added])

  const sold = normalizeListingSalesCount(product.soldCount)
  const popular = isShowcasePopular({
    soldCount: sold,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    isBestSeller: product.isBestSeller,
  })
  const discount = resolveProductDiscount(product.price, product.compareAt)
  const hasReviews = (product.reviewCount ?? 0) > 0 && (product.averageRating ?? 0) > 0
  const soldOut = product.stock != null && product.stock <= 0
  const highlights = product.highlights ?? []
  const warranty =
    product.warrantyMonths && product.warrantyMonths > 0
      ? product.warrantyMonths >= 12 && product.warrantyMonths % 12 === 0
        ? tCard("warrantyYears", { count: product.warrantyMonths / 12 })
        : tCard("warrantyMonths", { count: product.warrantyMonths })
      : null

  const visibleThumbs = images.length > MAX_THUMBS ? images.slice(0, MAX_THUMBS - 1) : images
  const extra = images.length > MAX_THUMBS ? images.length - (MAX_THUMBS - 1) : 0
  const heroSrc = images[Math.min(active, images.length - 1)]!

  const onAddToCart = useCallback(async () => {
    if (busy || soldOut) return
    setBusy(true)
    try {
      const result = await addToBuyerCart({
        productId: product.listingId,
        qty: 1,
        title: product.title,
        imageUrl: images[0] === PLACEHOLDER ? undefined : images[0],
        sellerName: product.sellerName ?? undefined,
        price: product.price,
      })
      if (result.ok) {
        setAdded(true)
        toast.success(t("added"))
      } else {
        toast.error(result.error)
      }
    } finally {
      setBusy(false)
    }
  }, [busy, images, product.listingId, product.price, product.sellerName, product.title, soldOut, t])

  const ctaClass = cn(
    "group/cta relative inline-flex min-h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-full px-6 text-[15px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(67,56,202,0.65)] transition duration-200",
    "bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:brightness-110 active:scale-[0.985]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
  )

  return (
    <article
      aria-labelledby={`showcase-${product.listingId}`}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-2.5 shadow-[0_34px_90px_-42px_rgba(91,33,217,0.45)] backdrop-blur-xl sm:p-3",
        "dark:border-white/10 dark:bg-zinc-950/80",
        className
      )}
    >
      {/* Media */}
      <div className="relative aspect-[4/3.4] w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-violet-100/80 via-white to-indigo-100/70 dark:from-violet-950/40 dark:via-zinc-950 dark:to-indigo-950/30 sm:aspect-[4/3.1]">
        <div
          className="pointer-events-none absolute -right-10 top-6 size-64 rounded-full bg-violet-300/35 blur-3xl dark:bg-violet-500/20"
          aria-hidden
        />

        <Link href={product.href} className="absolute inset-0 z-0" aria-label={t("viewProduct", { title: product.title })}>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote listing photos */}
          <img
            src={heroSrc}
            alt={product.title}
            className="absolute inset-0 h-full w-full select-none object-contain p-5 pb-24 transition-transform duration-500 group-hover:scale-[1.02] sm:p-8 sm:pb-24"
            loading={imagePriority ? "eager" : "lazy"}
            fetchPriority={imagePriority ? "high" : "auto"}
            decoding="async"
            draggable={false}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(PLACEHOLDER)) e.currentTarget.src = PLACEHOLDER
            }}
          />
        </Link>

        {/* Top-left live badges */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
          {shouldShowBuyerSalesCount(sold) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-[12px] font-semibold text-white shadow-md">
              <Truck className="size-3.5" aria-hidden />
              {tSales("count", { count: sold })}
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
            </span>
          ) : null}
          {popular ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-md">
              <Flame className="size-3.5" aria-hidden />
              {t("popular")}
            </span>
          ) : null}
        </div>

        {/* Heart with live like count */}
        <div className="absolute right-3 top-3 z-10">
          <div className="rounded-full bg-white/95 p-1 shadow-md ring-1 ring-black/5 backdrop-blur-sm dark:bg-zinc-900/90 dark:ring-white/10">
            <WishlistHeart productId={product.productId} />
          </div>
        </div>

        {/* Key benefits over the photo (sm+); on phones they sit under the media so the product stays visible */}
        {highlights.length > 0 ? (
          <div className="absolute left-3 top-[3.9rem] z-10 hidden max-w-[58%] sm:block">
            <ProductHighlightChips highlights={highlights} layout="overlay" ariaLabel={t("gallery")} />
          </div>
        ) : null}

        {/* Thumbnail rail */}
        {images.length > 1 ? (
          <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-center gap-2" role="tablist" aria-label={t("gallery")}>
            {visibleThumbs.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={t("thumbAria", { n: i + 1 })}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={cn(
                  "size-12 shrink-0 overflow-hidden rounded-xl border-2 bg-white shadow-sm transition sm:size-14",
                  active === i
                    ? "border-violet-500 ring-2 ring-violet-400/40"
                    : "border-white/90 opacity-90 hover:opacity-100 dark:border-zinc-700"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    if (!e.currentTarget.src.endsWith(PLACEHOLDER)) e.currentTarget.src = PLACEHOLDER
                  }}
                />
              </button>
            ))}
            {extra > 0 ? (
              <Link
                href={product.href}
                aria-label={t("viewProduct", { title: product.title })}
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-white/90 bg-zinc-300/80 text-sm font-bold text-white backdrop-blur-sm sm:size-14"
              >
                {t("moreImages", { count: extra })}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {highlights.length > 0 ? (
        <ProductHighlightChips highlights={highlights} layout="row" ariaLabel={t("gallery")} className="mt-2 px-1 sm:hidden" />
      ) : null}

      {/* Info */}
      <div className="px-1.5 pb-1.5 pt-4 sm:px-3">
        <div className="flex items-start gap-2">
          <h3 id={`showcase-${product.listingId}`} className="min-w-0 text-balance text-[1.35rem] font-bold leading-tight tracking-tight text-zinc-950 dark:text-white">
            <Link href={product.href} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              {product.title}
            </Link>
          </h3>
          {product.verified ? (
            <span className="mt-1 shrink-0 text-emerald-500" title={t("verified")}>
              <BadgeCheck className="size-6 fill-emerald-500/15" aria-hidden />
              <span className="sr-only">{t("verified")}</span>
            </span>
          ) : null}
        </div>

        {product.subtitle ? (
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-zinc-500 dark:text-zinc-400">{product.subtitle}</p>
        ) : null}

        {hasReviews ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars value={product.averageRating!} label={t("ratingAria", { rating: product.averageRating!.toFixed(1) })} />
            <span className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{product.averageRating!.toFixed(1)}</span>
            <span className="text-[14px] text-zinc-500 dark:text-zinc-400">
              ({t("reviews", { count: product.reviewCount! })})
            </span>
          </div>
        ) : null}

        <div className="mt-5 grid items-center gap-3 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="relative flex min-h-14 items-center gap-3 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 py-2 pl-4 pr-5 text-white shadow-[0_16px_34px_-16px_rgba(109,40,217,0.75)]">
            {discount ? (
              <span className="-ml-1 shrink-0 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 px-2.5 py-1 text-[13px] font-bold shadow-md ring-2 ring-white/30">
                −{discount.percent}%
              </span>
            ) : null}
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="text-[1.6rem] font-extrabold leading-none tabular-nums">{formatStoreCurrency(product.price)}</span>
              {discount ? (
                <span className="text-[15px] font-medium tabular-nums text-white/70 line-through">{formatStoreCurrency(discount.compareAt)}</span>
              ) : null}
            </span>
          </div>

          {product.needsOptions ? (
            <Link href={product.href} className={ctaClass}>
              <ShoppingBag className="size-[18px]" aria-hidden />
              {t("chooseOptions")}
              <ChevronRight className="size-[18px] transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            <button type="button" onClick={onAddToCart} disabled={busy || soldOut} className={ctaClass} aria-live="polite">
              {busy ? (
                <Loader2 className="size-[18px] animate-spin" aria-hidden />
              ) : (
                <ShoppingBag className="size-[18px]" aria-hidden />
              )}
              {soldOut ? t("soldOut") : busy ? t("adding") : added ? t("added") : t("addToCart")}
              {!soldOut && !busy ? (
                <ChevronRight className="size-[18px] transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
              ) : null}
            </button>
          )}
        </div>

        {product.freeShipping || warranty ? (
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {product.freeShipping ? (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Truck className="size-4" aria-hidden />
                {tCard("freeShipping")}
              </li>
            ) : null}
            {warranty ? (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-300" aria-hidden />
                {warranty}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </article>
  )
}
