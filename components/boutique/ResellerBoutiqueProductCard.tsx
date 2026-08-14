"use client"

import Image from "next/image"
import { Eye } from "lucide-react"

import { ProductDiscountTag } from "@/components/product-discount-tag"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { WishlistHeart } from "@/components/wishlist-heart"
import { Badge } from "@/components/ui/badge"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import { resolveBuyerCardImageHref } from "@/lib/listing-card-image-shared"
import { resolveProductDiscount } from "@/lib/product-discount-display"
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
  const discountOffer = resolveProductDiscount(priceEur, compareAtEur)
  const imageSrc = resolveBuyerCardImageHref(product.image, product.id)

  return (
    <article
      className="group rounded-3xl border p-3 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1"
      style={{
        background: "var(--boutique-card-bg)",
        borderColor: "var(--boutique-card-border)",
        boxShadow: "var(--boutique-card-shadow)",
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white">
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
          <div className="min-w-0 flex-1">
            <ProductSalesBadge
              count={product.soldCount}
              variant="overlay"
              className="!static left-auto top-auto max-w-full"
            />
          </div>
          <div className="pointer-events-auto shrink-0">
            <WishlistHeart productId={product.productId} className="relative" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-2">
          <div className="min-w-0">
            {discountOffer ? (
              <ProductDiscountTag
                percent={discountOffer.percent}
                className="!static relative bottom-auto left-auto"
              />
            ) : null}
          </div>
          <div className="shrink-0">
            {product.isBestSeller ? (
              <Badge className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm hover:bg-amber-500">
                Best Seller
              </Badge>
            ) : null}
          </div>
        </div>

        <Image
          src={imageSrc}
          alt={product.title}
          fill
          className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          unoptimized={imageSrc.startsWith("http") || imageSrc.startsWith("/uploads")}
        />

        {product.isOutOfStock ? (
          <span className="absolute left-3 top-12 z-10 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className="p-4 pt-4">
        <h2 className="text-lg font-bold leading-tight" style={{ color: "var(--boutique-card-title)" }}>
          {product.title}
        </h2>

        {product.buyerRewardBadge ? (
          <p className="mt-1.5">
            <span className="inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900 dark:bg-teal-950/50 dark:text-teal-200">
              {product.buyerRewardBadge}
            </span>
          </p>
        ) : null}

        <div className="mt-2">
          <ProductPriceOffer price={priceEur} compareAt={compareAtEur} layout="card" />
        </div>

        <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--boutique-card-muted)" }}>
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
