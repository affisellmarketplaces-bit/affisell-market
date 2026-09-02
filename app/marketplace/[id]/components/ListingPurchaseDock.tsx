"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bell,
  MousePointerClick,
  ShoppingBag,
  Zap,
} from "lucide-react"
import type { ReactNode, RefObject } from "react"
import nextDynamic from "next/dynamic"
import { MarketplacePurchaseQuantity } from "@/components/marketplace/marketplace-purchase-quantity"
import { CommissionnaireCheckoutDisclaimer } from "@/components/checkout/commissionnaire-checkout-disclaimer"
import { WishlistHeart } from "@/components/wishlist-heart"
import {
  formatStoreCurrency,
  formatStoreCurrencyFromCents,
} from "@/lib/market-config"
import { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/stripe-minimum"
import { cn } from "@/lib/utils"
import type { ListingShippingBlock } from "../listing-detail-types"
import { t } from "../listing-detail-utils"

const BookingComingSoonRail = nextDynamic(
  () =>
    import("@/components/booking/booking-coming-soon-rail").then((m) => ({
      default: m.BookingComingSoonRail,
    })),
  { loading: () => null }
)
const BookingCheckoutPanel = nextDynamic(
  () =>
    import("@/components/booking/booking-checkout-panel").then((m) => ({
      default: m.BookingCheckoutPanel,
    })),
  { loading: () => null }
)

type BrandClasses = ReturnType<typeof import("@/lib/storefront-pdp-brand").storefrontPdpBrandClasses>

type Props = {
  purchaseDockRef: RefObject<HTMLDivElement | null>
  reduceMotion: boolean | null
  brand: BrandClasses
  listingKind: string
  bookingCheckoutBlocked: boolean
  bookingCheckoutLive: boolean
  productId: string
  selectedBookingSlotId: string | null
  onSelectBookingSlot: (
    slotId: string | null,
    meta?: { seatsLeft: number; capacity: number; occupiedSeats: number }
  ) => void
  selectedSeatLabels: string[]
  onChangeSeatLabels: (labels: string[]) => void
  onMapReady: (usesNamedSeats: boolean) => void
  experienceBookingLive: boolean
  serviceBookingLive: boolean
  multiGuestBookingLive: boolean
  slotUsesNamedSeats: boolean
  bookingSlotRequired: boolean
  bookingSeatsRequired: boolean
  purchaseQty: number
  onQuantityChange: (qty: number) => void
  bookingTicketStock: number
  listingPriceEur: number
  compareRetailPriceEur: number | null
  hasRetailCompare: boolean
  buyNowLineSubtotalCents: number
  buyBusy: boolean
  onBuyNow: () => void
  brandedStorefront: boolean
  buyerRewardBadge?: string | null
  bookingCheckoutLabels: {
    priceLabel: string
    buyNowShort: string
    priceFluidityNote: string
    inStock: string
    outOfStock: string
    quantityOption: (count: number) => string
    quantityAria: string
  }
  shipping: ListingShippingBlock
  productT: {
    actionStackHint: string
    securePayment: string
    addToCart: string
    buyNowShort: string
    alertPriceDrop: string
    priceAlertSavedSub: string
    priceAlertSub: string
    inStock: string
    outOfStock: string
    quantityOption: string
    quantityAria: string
  }
  rewardBalanceCents: number
  maxApplicableReward: number
  useRewardCents: number
  onUseRewardChange: (cents: number) => void
  availableStock: number
  cartBusy: boolean
  onAddToCart: (e?: React.MouseEvent) => void
  alertSaved: boolean
  onSavePriceAlert: () => void
  compactCrossSellSlot?: ReactNode
  wishlistTitle: string
  affiliateCommissionnaireName: string
  supplierName: string
}

export function ListingPurchaseDock({
  purchaseDockRef,
  reduceMotion,
  brand,
  listingKind,
  bookingCheckoutBlocked,
  bookingCheckoutLive,
  productId,
  selectedBookingSlotId,
  onSelectBookingSlot,
  selectedSeatLabels,
  onChangeSeatLabels,
  onMapReady,
  experienceBookingLive,
  serviceBookingLive,
  multiGuestBookingLive,
  slotUsesNamedSeats,
  bookingSlotRequired,
  bookingSeatsRequired,
  purchaseQty,
  onQuantityChange,
  bookingTicketStock,
  listingPriceEur,
  compareRetailPriceEur,
  hasRetailCompare,
  buyNowLineSubtotalCents,
  buyBusy,
  onBuyNow,
  brandedStorefront,
  buyerRewardBadge,
  bookingCheckoutLabels,
  shipping,
  productT,
  rewardBalanceCents,
  maxApplicableReward,
  useRewardCents,
  onUseRewardChange,
  availableStock,
  cartBusy,
  onAddToCart,
  alertSaved,
  onSavePriceAlert,
  compactCrossSellSlot,
  wishlistTitle,
  affiliateCommissionnaireName,
  supplierName,
}: Props) {
  return (
    <motion.div
      ref={purchaseDockRef}
      id="listing-purchase-dock"
      className="relative hidden scroll-mt-28 rounded-[1.65rem] border border-zinc-200/90 bg-white p-5 shadow-[0_22px_56px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-black/50 dark:ring-white/[0.04] lg:block"
      initial={reduceMotion ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      {bookingCheckoutBlocked ? (
        <BookingComingSoonRail listingKind={listingKind} />
      ) : bookingCheckoutLive ? (
        <BookingCheckoutPanel
          productId={productId}
          listingKind={listingKind}
          selectedSlotId={selectedBookingSlotId}
          onSelectSlot={onSelectBookingSlot}
          selectedSeatLabels={selectedSeatLabels}
          onChangeSeatLabels={onChangeSeatLabels}
          onMapReady={onMapReady}
          experienceBookingLive={experienceBookingLive}
          serviceBookingLive={serviceBookingLive}
          multiGuestBookingLive={multiGuestBookingLive}
          slotUsesNamedSeats={slotUsesNamedSeats}
          bookingSlotRequired={bookingSlotRequired}
          bookingSeatsRequired={bookingSeatsRequired}
          purchaseQty={purchaseQty}
          onQuantityChange={onQuantityChange}
          bookingTicketStock={bookingTicketStock}
          listingPriceEur={listingPriceEur}
          activeRetailPriceEur={compareRetailPriceEur}
          hasRetailCompare={hasRetailCompare}
          buyNowLineSubtotalCents={buyNowLineSubtotalCents}
          buyBusy={buyBusy}
          onBuyNow={onBuyNow}
          brandedStorefront={brandedStorefront}
          reduceMotion={reduceMotion ?? false}
          buyerRewardBadge={buyerRewardBadge}
          labels={bookingCheckoutLabels}
        />
      ) : (
        <div className="flex flex-col">
          <div className="mb-3 hidden items-start gap-2.5 lg:flex">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25">
              <Zap className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{productT.actionStackHint}</span>
              <span className="mt-0.5 block text-[11px] text-zinc-500 dark:text-zinc-500">
                {productT.securePayment} · {shipping.deliveryMin}–{shipping.deliveryMax} day delivery
              </span>
            </p>
          </div>

          {rewardBalanceCents > 0 && maxApplicableReward > 0 ? (
            <div className="mb-4 rounded-2xl border border-teal-200/80 bg-teal-50/70 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">Use store credit</p>
                <Link
                  href="/marketplace/account/wallet"
                  className="text-xs font-medium text-teal-800 underline-offset-2 hover:underline dark:text-teal-300"
                >
                  Wallet
                </Link>
              </div>
              <p className="mt-1 text-xs text-teal-900/90 dark:text-teal-200/90">
                Balance {formatStoreCurrencyFromCents(rewardBalanceCents)} · up to{" "}
                {formatStoreCurrencyFromCents(maxApplicableReward)} on this checkout (
                {formatStoreCurrency(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS / 100)} card minimum).
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={maxApplicableReward}
                  step={1}
                  value={Math.min(useRewardCents, maxApplicableReward)}
                  onChange={(e) => onUseRewardChange(Number(e.target.value))}
                  className="min-w-[10rem] flex-1 accent-teal-600"
                  aria-label="Store credit to apply"
                />
                <span className="text-sm font-semibold tabular-nums text-teal-950 dark:text-teal-50">
                  {formatStoreCurrencyFromCents(Math.min(useRewardCents, maxApplicableReward))}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-teal-300 bg-white px-2 py-0.5 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/50"
                  onClick={() => onUseRewardChange(maxApplicableReward)}
                >
                  Max
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-teal-300 bg-white px-2 py-0.5 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/50"
                  onClick={() => onUseRewardChange(0)}
                >
                  None
                </button>
              </div>
            </div>
          ) : null}

          <MarketplacePurchaseQuantity
            className="mb-1"
            quantity={purchaseQty}
            onQuantityChange={onQuantityChange}
            availableStock={multiGuestBookingLive && !slotUsesNamedSeats ? bookingTicketStock : availableStock}
            inStockLabel={productT.inStock}
            outOfStockLabel={productT.outOfStock}
            quantityOptionLabel={(count) => t(productT.quantityOption, { count })}
            quantityAriaLabel={productT.quantityAria}
            disabled={
              cartBusy ||
              buyBusy ||
              bookingCheckoutBlocked ||
              bookingSlotRequired ||
              bookingSeatsRequired ||
              serviceBookingLive ||
              slotUsesNamedSeats
            }
          />

          <div className="flex flex-col gap-2.5 lg:gap-3">
            <div className="flex gap-2 lg:block">
              <motion.button
                type="button"
                disabled={cartBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingCheckoutLive}
                whileHover={{ scale: availableStock > 0 && !cartBusy ? 1.01 : 1 }}
                whileTap={{ scale: availableStock > 0 && !cartBusy ? 0.99 : 1 }}
                onClick={(e) => onAddToCart(e)}
                className={cn("group flex h-12 min-w-0 flex-1 lg:w-full", brand.ctaPrimary)}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden />
                <ShoppingBag className="relative h-5 w-5 shrink-0" aria-hidden />
                <span className="relative">{cartBusy ? "Adding…" : productT.addToCart}</span>
              </motion.button>
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900/60 lg:hidden"
                aria-label={wishlistTitle}
              >
                <WishlistHeart productId={productId} />
              </div>
            </div>

            <motion.button
              type="button"
              disabled={buyBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingSlotRequired || bookingSeatsRequired}
              whileHover={{ scale: availableStock > 0 && !buyBusy ? 1.012 : 1 }}
              whileTap={{ scale: availableStock > 0 && !buyBusy ? 0.988 : 1 }}
              onClick={onBuyNow}
              className={cn("group flex h-12 w-full", brand.ctaSecondary)}
            >
              <MousePointerClick className={cn("h-4 w-4 shrink-0 lg:hidden", brand.accentIcon)} aria-hidden />
              <span className="relative">{buyBusy ? "Redirecting…" : productT.buyNowShort}</span>
              <ArrowRight className={cn("hidden h-5 w-5 shrink-0 lg:block", brand.accentIcon)} aria-hidden />
            </motion.button>

            <CommissionnaireCheckoutDisclaimer
              affiliateName={affiliateCommissionnaireName}
              supplierName={supplierName}
              className="mt-1"
            />

            <button
              type="button"
              onClick={onSavePriceAlert}
              className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-zinc-200/90 bg-zinc-100/80 px-3 py-2.5 text-left text-xs font-semibold text-zinc-900 transition hover:border-amber-300/80 hover:bg-amber-50/50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-amber-700/50 dark:hover:bg-amber-950/25 lg:rounded-2xl lg:px-3.5 lg:py-3 lg:text-sm"
            >
              <span className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                {alertSaved ? "Saved" : productT.alertPriceDrop}
              </span>
              <span className="text-[10px] font-normal leading-tight text-zinc-500 dark:text-zinc-400">
                {alertSaved ? productT.priceAlertSavedSub : productT.priceAlertSub}
              </span>
            </button>
          </div>

          {compactCrossSellSlot ? (
            <div key="compact-cross-sell" className="mt-4 min-w-0">
              {compactCrossSellSlot}
            </div>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}
