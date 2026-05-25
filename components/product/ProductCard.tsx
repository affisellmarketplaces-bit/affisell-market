"use client"

import Link from "next/link"
import { Heart } from "lucide-react"

import { ProductDiscountTag } from "@/components/product-discount-tag"
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
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {freeShipping ? (
        <li>
          <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
            Livraison offerte
          </span>
        </li>
      ) : null}
      {warrantyLabel ? (
        <li>
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            {warrantyLabel}
          </span>
        </li>
      ) : null}
      <li>
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
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
  const hasDiscount = compareN != null && compareN > priceN
  const discount = hasDiscount ? Math.round(((compareN - priceN) / compareN) * 100) : 0
  const src = p.image || "/placeholder-product.jpg"
  const reward = p.buyerRewardBadge

  const showBusiness = mode === "affiliate" || mode === "supplier"
  const showMargin = mode === "affiliate"

  return (
    <Link
      href={href}
      prefetch={mode === "customer"}
      className={cn(
        "group flex h-full w-full flex-col rounded-3xl border border-gray-100/90 bg-white/85 p-2 shadow-sm outline-none ring-offset-2 backdrop-blur-sm transition-shadow dark:border-zinc-800 dark:bg-zinc-950/60",
        "hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/5 focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:border-violet-800/60"
      )}
      data-product-card-mode={mode}
      data-show-business-data={showBusiness ? "true" : "false"}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-violet-50/40 to-teal-50/25 dark:border-zinc-800/80 dark:from-violet-950/25 dark:to-teal-950/15">
        {hasDiscount ? <ProductDiscountTag percent={discount} /> : null}
        {p.isBestSeller ? (
          <Badge className="absolute bottom-2 left-2 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm hover:bg-amber-500">
            Best Seller
          </Badge>
        ) : null}
        {productIdStr ? (
          <WishlistHeart productId={productIdStr} className="absolute right-3 top-3 z-20" />
        ) : (
          <span className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur">
            <Heart className="h-4 w-4 text-gray-700" aria-hidden />
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- remote URLs + placeholder */}
        <img
          src={src}
          alt={p.title}
          className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-product.jpg"
          }}
        />
      </div>

      <div className="mt-3 px-1 pb-1">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-gray-900 dark:text-zinc-100">{p.title}</h3>
        {reward ? (
          <p className="mt-1.5">
            <span className="inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
              {reward}
            </span>
          </p>
        ) : null}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-black text-gray-900 dark:text-white">{formatStoreCurrency(priceN)}</span>
          {hasDiscount && compareN != null ? (
            <span className="text-compare-at text-sm tabular-nums line-through">{formatStoreCurrency(compareN)}</span>
          ) : null}
        </div>

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
    </Link>
  )
}
