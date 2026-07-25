"use client"

import { ShoppingBag } from "lucide-react"
import type { MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import { cn } from "@/lib/utils"

type Props = {
  titleHeadline: string
  priceDisplay: string
  buyNowLabel: string
  addToCartLabel: string
  buyBusy: boolean
  cartBusy: boolean
  availableStock: number
  buyDisabled: boolean
  cartDisabled: boolean
  onBuyNow: () => void
  onAddToCart: (e: MouseEvent<HTMLButtonElement>) => void
  brandedStorefront?: boolean
  /** `dock` = fixed bottom; `inline` = under gallery (first fold). */
  placement: "dock" | "inline"
  className?: string
  ariaLabel: string
}

/**
 * Persistent mobile Buy/Add — always on-screen (Amazon/Shopify pattern).
 * Never gated by IntersectionObserver.
 */
export function MobilePdpPersistentBuyBar({
  titleHeadline,
  priceDisplay,
  buyNowLabel,
  addToCartLabel,
  buyBusy,
  cartBusy,
  availableStock,
  buyDisabled,
  cartDisabled,
  onBuyNow,
  onAddToCart,
  brandedStorefront = false,
  placement,
  className,
  ariaLabel,
}: Props) {
  const brand = storefrontPdpBrandClasses(brandedStorefront)
  if (availableStock <= 0) return null

  const shell =
    placement === "dock"
      ? "fixed inset-x-0 bottom-0 z-[90] max-w-[100vw] px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:hidden"
      : "lg:hidden"

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(shell, className)}
      data-affisell-mobile-buy={placement}
    >
      <div className={cn(brand.stickyBar, placement === "inline" && "shadow-md")}>
        <div className="min-w-0 flex-[0.85]">
          {placement === "dock" ? (
            <p className="truncate text-[11px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              {titleHeadline}
            </p>
          ) : null}
          <p className={cn(brand.stickyPrice, placement === "inline" && "text-base")}>{priceDisplay}</p>
        </div>
        <div className="flex min-w-0 flex-[1.5] items-center gap-1.5">
          <Button
            type="button"
            disabled={buyDisabled || buyBusy}
            onClick={() => onBuyNow()}
            className={brand.stickySecondaryBtn}
          >
            {buyBusy ? "…" : buyNowLabel}
          </Button>
          <Button
            type="button"
            disabled={cartDisabled || cartBusy}
            onClick={(e) => onAddToCart(e)}
            className={cn(brand.ctaPrimarySticky, "inline-flex items-center justify-center gap-1")}
          >
            <ShoppingBag className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            <span className="truncate">{cartBusy ? "…" : addToCartLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
