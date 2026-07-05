"use client"

import { ArrowRight, MousePointerClick } from "lucide-react"
import { motion } from "framer-motion"

import { BookingNamedSeatPicker } from "@/components/booking/booking-named-seat-picker"
import { BookingSlotPicker } from "@/components/booking/booking-slot-picker"
import { ListingPriceActionCard } from "@/components/marketplace/listing-price-action-card"
import { MarketplacePurchaseQuantity } from "@/components/marketplace/marketplace-purchase-quantity"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import { cn } from "@/lib/utils"

type SlotPickMeta = {
  seatsLeft: number
  capacity: number
  occupiedSeats: number
}

export type BookingCheckoutPanelProps = {
  className?: string
  productId: string
  listingKind: string
  selectedSlotId: string | null
  onSelectSlot: (slotId: string | null, meta?: SlotPickMeta) => void
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
  activeRetailPriceEur: number | null
  hasRetailCompare: boolean
  buyNowLineSubtotalCents: number
  buyBusy: boolean
  onBuyNow: () => void
  brandedStorefront?: boolean
  reduceMotion?: boolean
  buyerRewardBadge?: string | null
  labels: {
    priceLabel: string
    buyNowShort: string
    priceFluidityNote: string
    inStock: string
    outOfStock: string
    quantityOption: (count: number) => string
    quantityAria: string
  }
  /** When false, only slot/seat pickers (desktop header teaser). */
  showPurchaseActions?: boolean
}

export function BookingCheckoutPanel({
  className,
  productId,
  listingKind,
  selectedSlotId,
  onSelectSlot,
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
  activeRetailPriceEur,
  hasRetailCompare,
  buyNowLineSubtotalCents,
  buyBusy,
  onBuyNow,
  brandedStorefront = false,
  reduceMotion = false,
  buyerRewardBadge = null,
  labels,
  showPurchaseActions = true,
}: BookingCheckoutPanelProps) {
  const brand = storefrontPdpBrandClasses(brandedStorefront)
  const checkoutReady = !bookingSlotRequired && !bookingSeatsRequired
  const buyStock = checkoutReady ? Math.max(1, bookingTicketStock) : 0

  return (
    <div className={cn("space-y-4", className)}>
      <BookingSlotPicker
        productId={productId}
        listingKind={listingKind}
        selectedSlotId={selectedSlotId}
        onSelectSlot={onSelectSlot}
      />
      {experienceBookingLive && selectedSlotId ? (
        <BookingNamedSeatPicker
          productId={productId}
          slotId={selectedSlotId}
          selectedLabels={selectedSeatLabels}
          onChangeLabels={onChangeSeatLabels}
          onMapReady={onMapReady}
        />
      ) : null}

      {showPurchaseActions ? (
        <>
          <ListingPriceActionCard
            priceLabel={labels.priceLabel}
            listingPriceEur={listingPriceEur}
            activeRetailPriceEur={activeRetailPriceEur}
            hasRetailCompare={hasRetailCompare}
            buyerRewardBadge={buyerRewardBadge}
            buyNowLineSubtotalCents={buyNowLineSubtotalCents}
            buyBusy={buyBusy}
            availableStock={buyStock}
            onBuyNow={onBuyNow}
            priceFluidityNote={labels.priceFluidityNote}
            buyNowShort={labels.buyNowShort}
            reduceMotion={reduceMotion}
            brandedStorefront={brandedStorefront}
          />

          {multiGuestBookingLive && !slotUsesNamedSeats && !serviceBookingLive ? (
            <MarketplacePurchaseQuantity
              quantity={purchaseQty}
              onQuantityChange={onQuantityChange}
              availableStock={bookingTicketStock}
              inStockLabel={labels.inStock}
              outOfStockLabel={labels.outOfStock}
              quantityOptionLabel={labels.quantityOption}
              quantityAriaLabel={labels.quantityAria}
              disabled={buyBusy || bookingSlotRequired}
            />
          ) : null}

          <motion.button
            type="button"
            disabled={buyBusy || !checkoutReady || buyStock <= 0}
            whileHover={{ scale: checkoutReady && !buyBusy ? 1.012 : 1 }}
            whileTap={{ scale: checkoutReady && !buyBusy ? 0.988 : 1 }}
            onClick={() => onBuyNow()}
            className={cn("group flex h-12 w-full lg:hidden", brand.ctaSecondary)}
          >
            <MousePointerClick className={cn("h-4 w-4 shrink-0", brand.accentIcon)} aria-hidden />
            <span className="relative">{buyBusy ? "Redirecting…" : labels.buyNowShort}</span>
            <ArrowRight className={cn("ml-auto h-5 w-5 shrink-0", brand.accentIcon)} aria-hidden />
          </motion.button>
        </>
      ) : null}
    </div>
  )
}
