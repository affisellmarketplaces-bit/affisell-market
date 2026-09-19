"use client"

import Image from "next/image"
import { Eye } from "lucide-react"

import { ProductColorSwatchDots } from "@/components/product/product-color-swatch-dots"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { WishlistHeart } from "@/components/wishlist-heart"
import { Badge } from "@/components/ui/badge"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import { formatResellerVariantOptionsLabel } from "@/lib/boutique/reseller-listing-variants-shared"
import { resolveBuyerCardImageHref } from "@/lib/listing-card-image-shared"
import { cn } from "@/lib/utils"

type Props = {
  product: ResellerStorefrontListProduct
  productCardTrustLine: string
  onViewProduct: (listingId: string) => void
}

export function ResellerBoutiqueProductCard({
  product,
  productCardTrustLine,
  onViewProduct,
}: Props) {
  const priceEur = product.priceCents / 100
  const compareAtEur =
    product.compareAtCents != null && product.compareAtCents > product.priceCents
      ? product.compareAtCents / 100
      : null
  const imageSrc = resolveBuyerCardImageHref(product.image, product.id)
  const optionsLabel = formatResellerVariantOptionsLabel(product.variantSummary)
  const showFromPrice =
    product.variantSummary.hasMultipleOptions &&
    product.variantSummary.priceFromCents !== product.variantSummary.priceToCents
  const displayPriceEur = showFromPrice
    ? product.variantSummary.priceFromCents / 100
    : priceEur

  return (
    <article
      className="group rounded-2xl border p-3 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-xl"
      style={{
        background: "var(--boutique-card-bg)",
        borderColor: "var(--boutique-card-border)",
        boxShadow: "var(--boutique-card-shadow, 0 20px 60px rgba(0, 0, 0, 0.15))",
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white">
        {/* Photo rule: nothing written sits on the product photo. Only the like-heart (a control) stays. */}
        <div className="pointer-events-auto absolute right-2 top-2 z-20 shrink-0">
          <WishlistHeart productId={product.productId} className="relative" />
        </div>

        <Image
          src={imageSrc}
          alt={product.title}
          fill
          className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          unoptimized={imageSrc.startsWith("http") || imageSrc.startsWith("/uploads")}
        />

      </div>

      <div className="p-4 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 empty:hidden">
          {product.isOutOfStock ? (
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">Out of stock</span>
          ) : null}
          <ProductSalesBadge count={product.soldCount} variant="inline" />
          {product.isBestSeller ? (
            <Badge className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm hover:bg-amber-500">
              Best Seller
            </Badge>
          ) : null}
        </div>
        <h2
          className="text-lg font-medium leading-tight tracking-tight"
          style={{ color: "var(--boutique-card-title)" }}
        >
          {product.title}
        </h2>

        {product.buyerRewardBadge ? (
          <p className="mt-1.5">
            <span className="inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900 dark:bg-teal-950/50 dark:text-teal-200">
              {product.buyerRewardBadge}
            </span>
          </p>
        ) : null}

        {optionsLabel ? (
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <ProductColorSwatchDots
              colors={product.colorSwatchNames}
              max={6}
              sizeClassName="h-4 w-4"
            />
            <span
              className="text-[11px] font-medium uppercase tracking-wide opacity-70"
              style={{ color: "var(--boutique-card-muted)" }}
            >
              {optionsLabel}
            </span>
          </p>
        ) : null}

        <div className="mt-2">
          {showFromPrice ? (
            <p
              className="text-lg font-bold tabular-nums tracking-tight"
              style={{ color: "var(--boutique-card-title)" }}
            >
              {product.priceLabel}
            </p>
          ) : (
            <ProductPriceOffer price={displayPriceEur} compareAt={compareAtEur} layout="card" />
          )}
        </div>

        <p
          className="mt-2 line-clamp-2 text-xs uppercase tracking-widest opacity-60"
          style={{ color: "var(--boutique-card-muted)" }}
        >
          {productCardTrustLine}
        </p>

        <button
          type="button"
          onClick={() => onViewProduct(product.id)}
          className={cn(
            "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-white transition-all duration-300 group-hover:scale-[1.01]",
            product.isOutOfStock && "opacity-60"
          )}
          style={{
            backgroundImage: "linear-gradient(90deg, var(--boutique-button-from), var(--boutique-button-to))",
            boxShadow: "var(--boutique-button-shadow)",
          }}
        >
          <Eye className="size-4" aria-hidden />
          Voir le produit
        </button>
      </div>
    </article>
  )
}
