"use client"

import Link from "next/link"
import { Heart, Sparkles } from "lucide-react"

import { FastLink } from "@/components/navigation/fast-link"

import { ProductDiscountTag } from "@/components/product-discount-tag"
import { ProductOfferBadge } from "@/components/product/product-offer-badge"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { resolveProductDiscount } from "@/lib/product-discount-display"
import { Badge } from "@/components/ui/badge"
import { WishlistHeart } from "@/components/wishlist-heart"
import { formatStoreCurrency, formatStoreCurrencyFromCents } from "@/lib/market-config"
import { calcMarginCents } from "@/lib/product-card-margin"
import { cn } from "@/lib/utils"

export type ProductCardDisplayMode = "affiliate" | "customer" | "supplier"

export type ProductCardProduct = {
  title?: string
  name?: string
  image?: string
  images?: string[]
  price: number | string
  compareAt?: number | string | null
  store?: string | null
  isBestSeller?: boolean
  soldCount?: number
  marginCents?: number
  supplierPrice?: number
  commissionPct?: number
  deliveryLabel?: string
  freeShipping?: boolean
  warrantyLabel?: string | null
  stock?: number
  averageRating?: number
  reviewCount?: number
  isSponsored?: boolean
  sponsorPlacement?: string | null
  offerMode?: string
  minOrderQuantity?: number
  offerBadge?: { label: string; shortLabel: string; tone: string; icon: string } | null
}

type ProductCardProps = {
  product: ProductCardProduct | Record<string, unknown>
  /** Parent decides buyer vs merchant context. Defaults to customer (RGPD-safe). */
  mode?: ProductCardDisplayMode
  href?: string
}

function coerceProduct(p: ProductCardProps["product"]) {
  const o = p as Record<string, unknown>
  const title = String(o.title ?? o.name ?? "")
  const images = o.images
  const imageFromArr = Array.isArray(images) && typeof images[0] === "string" ? images[0] : ""
  const image = String(o.image ?? imageFromArr ?? "").trim()
  const priceRaw = o.price
  let price = Number(priceRaw)
  if (!Number.isFinite(price) && typeof o.sellingPriceCents === "number") {
    price = o.sellingPriceCents / 100
  }
  if (!Number.isFinite(price)) price = 0
  const c = o.compareAt
  const compareAt =
    c != null && c !== "" && Number.isFinite(Number(c)) ? Number(c) : null
  const store = (o.store ?? null) as string | null
  const isBestSeller = Boolean(o.isBestSeller)
  const buyerRewardBadge =
    typeof o.buyerRewardBadge === "string" && o.buyerRewardBadge.trim()
      ? o.buyerRewardBadge.trim()
      : null
  const soldRaw = o.soldCount
  const soldCount =
    typeof soldRaw === "number" && Number.isFinite(soldRaw) && soldRaw > 0 ? soldRaw : null
  const marginRaw = o.marginCents
  let marginCents =
    typeof marginRaw === "number" && Number.isFinite(marginRaw) && marginRaw > 0 ? marginRaw : null
  if (marginCents == null) {
    const supplierRaw = o.supplierPrice
    const supplierPrice =
      typeof supplierRaw === "number" && Number.isFinite(supplierRaw) ? supplierRaw : null
    marginCents = calcMarginCents(price, supplierPrice)
  }
  const commissionRaw = o.commissionPct
  const commissionPct =
    typeof commissionRaw === "number" && Number.isFinite(commissionRaw) && commissionRaw > 0
      ? Math.round(commissionRaw)
      : null
  const deliveryLabel =
    typeof o.deliveryLabel === "string" && o.deliveryLabel.trim() ? o.deliveryLabel.trim() : null
  const freeShipping = Boolean(o.freeShipping)
  const warrantyLabel =
    typeof o.warrantyLabel === "string" && o.warrantyLabel.trim()
      ? o.warrantyLabel.trim()
      : null
  const stockRaw = o.stock
  const stock =
    typeof stockRaw === "number" && Number.isFinite(stockRaw) ? stockRaw : null
  const averageRating =
    typeof o.averageRating === "number" && Number.isFinite(o.averageRating) ? o.averageRating : null
  const reviewCount =
    typeof o.reviewCount === "number" && Number.isFinite(o.reviewCount) ? o.reviewCount : null
  return {
    title,
    image,
    price,
    compareAt,
    store,
    isBestSeller,
    buyerRewardBadge,
    soldCount,
    marginCents,
    commissionPct,
    deliveryLabel,
    freeShipping,
    warrantyLabel,
    stock,
    averageRating,
    reviewCount,
    isSponsored: Boolean(o.isSponsored),
    sponsorPlacement:
      typeof o.sponsorPlacement === "string" && o.sponsorPlacement.trim()
        ? o.sponsorPlacement.trim()
        : null,
    offerMode: typeof o.offerMode === "string" ? o.offerMode : "STANDARD",
    minOrderQuantity:
      typeof o.minOrderQuantity === "number" ? Math.max(1, o.minOrderQuantity) : 1,
    offerBadge:
      o.offerBadge && typeof o.offerBadge === "object" ? (o.offerBadge as ProductCardProduct["offerBadge"]) : null,
  }
}

function BusinessBadges({
  mode,
  soldCount,
  marginCents,
  commissionPct,
  deliveryLabel,
}: {
  mode: "affiliate" | "supplier"
  soldCount: number | null
  marginCents: number | null
  commissionPct: number | null
  deliveryLabel: string | null
}) {
  const showMargin = mode === "affiliate"
  const marginBadge = showMargin && marginCents != null ? marginCents : null
  const hasAny =
    soldCount != null || marginBadge != null || commissionPct != null || deliveryLabel
  if (!hasAny) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {soldCount != null ? (
        <li>
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            {soldCount} vente{soldCount > 1 ? "s" : ""}
          </span>
        </li>
      ) : null}
      {marginBadge != null ? (
        <li>
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            Marge {formatStoreCurrencyFromCents(marginBadge, { maximumFractionDigits: 2 })}
          </span>
        </li>
      ) : null}
      {commissionPct != null ? (
        <li>
          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
            Commission {commissionPct}%
          </span>
        </li>
      ) : null}
      {deliveryLabel ? (
        <li>
          <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
            Delivery {deliveryLabel}
          </span>
        </li>
      ) : null}
    </ul>
  )
}

function CustomerConversionBadges({
  freeShipping,
  warrantyLabel,
}: {
  freeShipping: boolean
  warrantyLabel: string | null
}) {
  const hasAny = freeShipping || warrantyLabel
  if (!hasAny) return null
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1 sm:mt-2 sm:gap-1.5">
      {freeShipping ? (
        <li>
          <span className="inline-flex rounded-full bg-sky-100 px-1.5 py-px text-[9px] font-semibold text-sky-900 sm:px-2 sm:py-0.5 sm:text-[10px] dark:bg-sky-950/60 dark:text-sky-200">
            Livraison offerte
          </span>
        </li>
      ) : null}
      {warrantyLabel ? (
        <li>
          <span className="inline-flex rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-semibold text-emerald-900 sm:px-2 sm:py-0.5 sm:text-[10px] dark:bg-emerald-950/60 dark:text-emerald-200">
            {warrantyLabel}
          </span>
        </li>
      ) : null}
      <li className="max-sm:hidden">
        <span className="inline-flex rounded-full bg-violet-100 px-1.5 py-px text-[9px] font-semibold text-violet-900 sm:px-2 sm:py-0.5 sm:text-[10px] dark:bg-violet-950/60 dark:text-violet-200">
          Paiement 3x
        </span>
      </li>
    </ul>
  )
}

export function ProductCard({ product, mode = "customer", href: hrefProp }: ProductCardProps) {
  const o = product as Record<string, unknown>
  const p = coerceProduct(product)
  const listingRaw = o.listingId ?? o.id
  const listingId =
    typeof listingRaw === "string"
      ? listingRaw
      : listingRaw != null && listingRaw !== ""
        ? String(listingRaw)
        : ""
  const pid = o.productId
  const productIdStr =
    typeof pid === "string" ? pid : pid != null && pid !== "" ? String(pid) : ""
  const storeSlugRaw = o.storeSlug
  const storeSlug =
    typeof storeSlugRaw === "string" && storeSlugRaw.trim()
      ? storeSlugRaw.trim()
      : null
  const href =
    hrefProp ??
    (typeof o.href === "string" && o.href
      ? o.href
      : listingId && storeSlug && mode === "customer"
        ? `/shops/${encodeURIComponent(storeSlug)}/product/${encodeURIComponent(listingId)}`
        : listingId
          ? `/marketplace/${encodeURIComponent(listingId)}`
          : mode === "customer"
            ? "/#explorer"
            : "/marketplace")
  const priceN = p.price
  const compareN = p.compareAt
  const discountOffer = resolveProductDiscount(priceN, compareN)
  const hasDiscount = discountOffer != null
  const src = p.image || "/placeholder-product.jpg"
  const reward = p.buyerRewardBadge

  const showBusiness = mode === "affiliate" || mode === "supplier"
  const showMargin = mode === "affiliate"
  const LinkComp = mode === "customer" ? FastLink : Link

  return (
    <LinkComp
      href={href}
      prefetch={mode === "customer" ? undefined : false}
      className={cn(
        "group flex h-full w-full touch-manipulation flex-col rounded-2xl border border-gray-100/90 bg-white/85 p-1 shadow-sm outline-none ring-offset-2 backdrop-blur-sm transition-[transform,box-shadow,border-color] active:scale-[0.985] sm:rounded-3xl sm:p-2 dark:border-zinc-800 dark:bg-zinc-950/60",
        "hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/5 focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:border-violet-800/60"
      )}
      data-product-card-mode={mode}
      data-show-business-data={showBusiness ? "true" : "false"}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/50 bg-gradient-to-br from-violet-50/40 to-teal-50/25 sm:rounded-2xl dark:border-zinc-800/80 dark:from-violet-950/25 dark:to-teal-950/15">
        {p.offerBadge ? <ProductOfferBadge badge={p.offerBadge} /> : null}
        {hasDiscount ? <ProductDiscountTag percent={discountOffer.percent} /> : null}
        {!showBusiness && p.soldCount != null ? (
          <ProductSalesBadge count={p.soldCount} variant="overlay" />
        ) : null}
        {p.isSponsored ? (
          <Badge className="absolute bottom-1.5 left-1.5 z-10 gap-1 rounded-full border-0 bg-gradient-to-r from-violet-600 to-cyan-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg shadow-violet-900/40 hover:from-violet-500 hover:to-cyan-400 sm:bottom-2 sm:left-2 sm:px-2 sm:text-[10px]">
            <Sparkles className="size-3" aria-hidden />
            Promote
          </Badge>
        ) : p.isBestSeller ? (
          <Badge className="absolute bottom-1.5 left-1.5 z-10 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm hover:bg-amber-500 sm:bottom-2 sm:left-2 sm:px-2 sm:text-[10px]">
            Best Seller
          </Badge>
        ) : null}
        {productIdStr ? (
          <WishlistHeart productId={productIdStr} className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3" />
        ) : (
          <span className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur sm:right-3 sm:top-3 sm:h-9 sm:w-9">
            <Heart className="h-4 w-4 text-gray-700" aria-hidden />
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- remote URLs + placeholder */}
        <img
          src={src}
          alt={p.title}
          className="absolute inset-0 h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105 sm:p-4"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-product.jpg"
          }}
        />
      </div>

      <div className="mt-1.5 px-0.5 pb-0.5 sm:mt-3 sm:px-1 sm:pb-1">
        <h3 className="line-clamp-2 min-h-[2.1rem] text-[12px] font-semibold leading-snug text-gray-900 sm:min-h-[2.5rem] sm:text-sm dark:text-zinc-100">
          {p.title}
        </h3>
        {reward ? (
          <p className="mt-1">
            <span className="inline-flex rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-900 sm:px-2 sm:text-[10px]">
              {reward}
            </span>
          </p>
        ) : null}
        <div className="mt-1.5">
          <ProductPriceOffer
            price={priceN}
            compareAt={compareN}
            layout="card"
            offerMode={p.offerMode}
          />
        </div>
        {p.offerMode === "WHOLESALE_ONLY" && p.minOrderQuantity > 1 ? (
          <p className="mt-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
            MOQ {p.minOrderQuantity} unités
          </p>
        ) : null}

        {showBusiness ? (
          <>
            <BusinessBadges
              mode={showMargin ? "affiliate" : "supplier"}
              soldCount={p.soldCount}
              marginCents={p.marginCents}
              commissionPct={p.commissionPct}
              deliveryLabel={p.deliveryLabel}
            />
            {p.store ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Supplier · {p.store}</p>
            ) : null}
          </>
        ) : (
          <CustomerConversionBadges freeShipping={p.freeShipping} warrantyLabel={p.warrantyLabel} />
        )}
      </div>
    </LinkComp>
  )
}
