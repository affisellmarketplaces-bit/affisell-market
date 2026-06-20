"use client"

import { motion } from "framer-motion"
import { ShoppingBag, Star } from "lucide-react"
import Link from "next/link"
import { forwardRef, type MouseEvent } from "react"

import { MarketplacePurchaseQuantity } from "@/components/marketplace/marketplace-purchase-quantity"
import { ListingPriceActionCard } from "@/components/marketplace/listing-price-action-card"
import { ProductColorSwatchButton, resolveCatalogColorSwatch } from "@/components/product/product-color-swatch-button"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { WishlistHeart } from "@/components/wishlist-heart"
import { shopperColorLabelsMatch } from "@/lib/marketplace-color-meta"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import { cn } from "@/lib/utils"

export type MobilePdpColorMeta = {
  name: string
  meta?: { hex: string; multicolor?: boolean }
  imageUrl?: string | null
}

export type MobilePdpBuyPanelProps = {
  titleHeadline: string
  titleSubline: string | null
  categoryEyebrow: string | null
  listingPriceEur: number
  activeRetailPriceEur: number | null
  hasRetailCompare: boolean
  salesCount: number
  reviewAverage: number
  reviewCount: number
  reviewsHref?: string
  colorMeta: MobilePdpColorMeta[]
  showColorSwatches: boolean
  selectedColor: string | null
  onSelectColor: (name: string) => void
  storageOptions: string[]
  selectedStorage: string | null
  onSelectStorage: (cap: string) => void
  isStorageOptionDisabled?: (cap: string) => boolean
  sizeOptions: string[]
  selectedSize: string | null
  onSelectSize: (size: string) => void
  availableStock: number
  purchaseQty: number
  onQuantityChange: (qty: number) => void
  cartBusy: boolean
  buyBusy: boolean
  onAddToCart: (e: MouseEvent<HTMLButtonElement>) => void
  onBuyNow: () => void
  buyNowLineSubtotalCents: number
  priceFluidityNote: string
  buyerRewardBadge?: string | null
  reduceMotion?: boolean
  productId: string
  labels: {
    colorLabel: string
    storageLabel: string
    sizeLabel: string
    priceLabel: string
    addToCart: string
    buyNowShort: string
    inStock: string
    outOfStock: string
    quantityOption: (count: number) => string
    quantityAria: string
    reviews: (count: string) => string
  }
  formatReviewCount: (n: number) => string
  className?: string
  brandedStorefront?: boolean
  /** Color swatches render next to gallery on PDP — hide duplicate here. */
  hideColorPicker?: boolean
}

export const MobilePdpBuyPanel = forwardRef<HTMLElement, MobilePdpBuyPanelProps>(
  function MobilePdpBuyPanel(
    {
      titleHeadline,
      titleSubline,
      categoryEyebrow,
      listingPriceEur,
      activeRetailPriceEur,
      hasRetailCompare,
      salesCount,
      reviewAverage,
      reviewCount,
      reviewsHref = "#listing-reviews",
      colorMeta,
      showColorSwatches,
      selectedColor,
      onSelectColor,
      storageOptions,
      selectedStorage,
      onSelectStorage,
      isStorageOptionDisabled,
      sizeOptions,
      selectedSize,
      onSelectSize,
      availableStock,
      purchaseQty,
      onQuantityChange,
      cartBusy,
      buyBusy,
      onAddToCart,
      onBuyNow,
      buyNowLineSubtotalCents,
      priceFluidityNote,
      buyerRewardBadge = null,
      reduceMotion = false,
      productId,
      labels,
      formatReviewCount,
      className,
      brandedStorefront = false,
      hideColorPicker = false,
    },
    ref
  ) {
    const brand = storefrontPdpBrandClasses(brandedStorefront)
    return (
      <section
        ref={ref}
        id="mobile-pdp-buy-panel"
        className={cn(brand.mobilePanel, className)}
        aria-label={labels.addToCart}
      >
        <header className="space-y-1.5">
          {categoryEyebrow ? (
            <span className={brand.mobileCategoryBadge}>
              {categoryEyebrow}
            </span>
          ) : null}
          <h1 className="text-[1.05rem] font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
            {titleHeadline}
          </h1>
          {titleSubline ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {titleSubline}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
            {salesCount > 0 ? (
              <ProductSalesBadge count={salesCount} variant="detail" className="!w-auto shrink-0" />
            ) : null}
            <div className="flex items-center gap-1 text-xs">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-3.5",
                      i < Math.round(reviewAverage)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"
                    )}
                    aria-hidden
                  />
                ))}
              </div>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {reviewAverage.toFixed(1)}
              </span>
              <Link
                href={reviewsHref}
                className={cn("font-medium", brand.accentText)}
              >
                {labels.reviews(formatReviewCount(reviewCount))}
              </Link>
            </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <WishlistHeart productId={productId} />
            </div>
          </div>
        </header>

        <ListingPriceActionCard
          priceLabel={labels.priceLabel}
          listingPriceEur={listingPriceEur}
          activeRetailPriceEur={activeRetailPriceEur}
          hasRetailCompare={hasRetailCompare}
          buyerRewardBadge={buyerRewardBadge ?? null}
          buyNowLineSubtotalCents={buyNowLineSubtotalCents}
          buyBusy={buyBusy}
          availableStock={availableStock}
          onBuyNow={onBuyNow}
          priceFluidityNote={priceFluidityNote}
          buyNowShort={labels.buyNowShort}
          reduceMotion={reduceMotion}
          brandedStorefront={brandedStorefront}
        />

        {colorMeta.length > 0 && !hideColorPicker ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                {showColorSwatches ? labels.colorLabel : "Option"}
              </p>
              {selectedColor ? (
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{selectedColor}</p>
              ) : null}
            </div>
            <div className="flex gap-2.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {colorMeta.map(({ name: colorName, meta, imageUrl }) =>
                showColorSwatches ? (
                  <ProductColorSwatchButton
                    key={colorName}
                    name={colorName}
                    meta={resolveCatalogColorSwatch(colorName, meta)}
                    imageUrl={imageUrl}
                    selected={shopperColorLabelsMatch(selectedColor, colorName)}
                    selectedClassName={brand.swatchSelectedRing}
                    unselectedClassName="border-zinc-300 dark:border-zinc-600"
                    onClick={() => onSelectColor(colorName)}
                  />
                ) : (
                  <button
                    key={colorName}
                    type="button"
                    onClick={() => onSelectColor(colorName)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-95",
                      shopperColorLabelsMatch(selectedColor, colorName)
                        ? brand.chipSelected
                        : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    )}
                  >
                    {colorName}
                  </button>
                )
              )}
            </div>
          </div>
        ) : null}

        {storageOptions.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {labels.storageLabel}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {storageOptions.map((cap) => {
                const disabled = isStorageOptionDisabled?.(cap) ?? false
                return (
                  <button
                    key={cap}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectStorage(cap)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-95",
                      selectedStorage === cap
                        ? brand.chipSelected
                        : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
                      disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    {cap}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {sizeOptions.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {labels.sizeLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelectSize(s)}
                  className={cn(
                    "min-w-[2.75rem] rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-95",
                    selectedSize === s
                      ? brand.chipSelected
                      : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-2">
          <MarketplacePurchaseQuantity
            variant="inline"
            quantity={purchaseQty}
            onQuantityChange={onQuantityChange}
            availableStock={availableStock}
            inStockLabel={labels.inStock}
            outOfStockLabel={labels.outOfStock}
            quantityOptionLabel={labels.quantityOption}
            quantityAriaLabel={labels.quantityAria}
            disabled={cartBusy || buyBusy}
          />
          <motion.button
            type="button"
            disabled={cartBusy || availableStock <= 0}
            whileTap={{ scale: availableStock > 0 && !cartBusy ? 0.98 : 1 }}
            onClick={onAddToCart}
            className={cn("flex h-11 items-center justify-center gap-2 rounded-full", brand.ctaPrimary)}
          >
            <ShoppingBag className="size-4 shrink-0" aria-hidden />
            {cartBusy ? "…" : labels.addToCart}
          </motion.button>
        </div>
      </section>
    )
  }
)
