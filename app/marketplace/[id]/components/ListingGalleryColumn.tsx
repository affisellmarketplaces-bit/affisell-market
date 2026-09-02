"use client"

import { motion } from "framer-motion"
import nextDynamic from "next/dynamic"
import type { RefObject } from "react"
import { Button } from "@/components/ui/button"
import { MobilePdpBuyPanel } from "@/components/product/mobile-pdp-buy-panel"
import { MobilePdpPersistentBuyBar } from "@/components/product/mobile-pdp-persistent-buy-bar"
import { ProductListingColorPicker } from "@/components/product/product-listing-color-picker"
import { ListingLogisticsStrip } from "@/components/product/listing-logistics-strip"
import { TryOnTrigger } from "@/components/try-on/TryOnEntry"
import { findVariantRowForShopperSelection } from "@/lib/marketplace-variant-dimensions"
import type { AffiliateVariantPricingMap } from "@/lib/affiliate-variant-pricing"
import type { ProductVariantsJson } from "@/lib/product-variants"
import type { CustomColumn } from "@/types/product"
import { formatStoreCount } from "@/lib/market-config"
import type { ListingDetailController } from "../use-listing-detail-controller"
import type { ListingDetailProps, ListingShippingBlock } from "../listing-detail-types"
import { t } from "../listing-detail-utils"
import { ProductGallery } from "./ProductGallery"

const BookingCheckoutPanel = nextDynamic(
  () =>
    import("@/components/booking/booking-checkout-panel").then((m) => ({
      default: m.BookingCheckoutPanel,
    })),
  { loading: () => null }
)

type Props = Pick<
  ListingDetailProps,
  | "productId"
  | "listingKind"
  | "name"
  | "offerBadge"
  | "has3D"
  | "galleryListingVideoUrl"
  | "brandedStorefront"
  | "storageOptions"
  | "variants"
  | "variantPricing"
  | "listingPriceCents"
  | "basePriceCents"
  | "lastStockCheck"
  | "lastStockStatus"
  | "flashPercent"
  | "flashEndsAt"
  | "isBattleWinner"
  | "priceReferenceEur"
  | "battleResellerName"
  | "buyerShipToCountry"
  | "buyerRewardBadge"
  | "salesCount"
  | "reviewSummary"
  | "crossSocialProof"
  | "arModel"
> & {
  ctrl: ListingDetailController
  shipping: ListingShippingBlock
  customColumns: CustomColumn[]
  mobilePurchaseRef: RefObject<HTMLElement | null>
}

export function ListingGalleryColumn({
  productId,
  listingKind,
  name,
  offerBadge,
  has3D,
  galleryListingVideoUrl,
  brandedStorefront,
  storageOptions = [],
  variants,
  variantPricing,
  listingPriceCents,
  basePriceCents,
  lastStockCheck,
  lastStockStatus,
  flashPercent,
  flashEndsAt,
  isBattleWinner,
  priceReferenceEur,
  battleResellerName,
  buyerShipToCountry,
  buyerRewardBadge,
  salesCount,
  reviewSummary,
  crossSocialProof = null,
  arModel,
  shipping,
  customColumns,
  mobilePurchaseRef,
  ctrl,
}: Props) {
  const {
    reduceMotion,
    productT,
    images,
    hero,
    activeThumbIndex,
    selectGalleryImage,
    titleHeadline,
    titleSubline,
    categoryEyebrow,
    priceDisplay,
    listingPriceEur,
    compareRetailPriceEur,
    hasRetailCompare,
    displayFlashPriceEur,
    buyNowLineSubtotalCents,
    colorMeta,
    showColorSwatches,
    selectedColor,
    selectColor,
    shopperSelection,
    selectedStorage,
    setSelectedStorage,
    selectedSize,
    setSelectedSize,
    sizeOptions,
    availableStock,
    purchaseQty,
    setPurchaseQty,
    cartBusy,
    buyBusy,
    addToCart,
    buyNow,
    bookingCheckoutLive,
    bookingCheckoutBlocked,
    bookingSlotRequired,
    bookingSeatsRequired,
    showAr,
    setShowAr,
    tryOnReady,
    tryOnVariant,
    setTryOnOpen,
    selectedBookingSlotId,
    handleSelectBookingSlot,
    selectedSeatLabels,
    setSelectedSeatLabels,
    setSlotUsesNamedSeats,
    experienceBookingLive,
    serviceBookingLive,
    multiGuestBookingLive,
    slotUsesNamedSeats,
    bookingTicketStock,
    bookingCheckoutLabels,
  } = ctrl

  return (
    <motion.div
      className="order-2 flex min-w-0 flex-col gap-2 sm:gap-3 lg:order-none lg:col-span-7 lg:row-start-2 lg:gap-8 lg:overflow-visible"
      initial={reduceMotion ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <section className="min-w-0 space-y-2 lg:space-y-4 lg:overflow-visible">
        <div className="relative z-20 max-lg:bg-gradient-to-b max-lg:from-white max-lg:via-white/98 max-lg:to-white/90 max-lg:pb-1 dark:max-lg:from-zinc-950 dark:max-lg:via-zinc-950/98 dark:max-lg:to-zinc-950/90">
          <ProductGallery
            images={images}
            heroSrc={hero}
            activeThumbIndex={activeThumbIndex}
            onSelectImage={selectGalleryImage}
            videoUrl={galleryListingVideoUrl}
            productId={productId}
            alt={name}
            offerBadge={offerBadge}
            has3D={has3D}
            view360Label={productT.view360}
          />

          {!bookingCheckoutLive && availableStock > 0 && !showAr ? (
            <MobilePdpPersistentBuyBar
              placement="inline"
              className="mx-1 mt-2 sm:mx-0"
              titleHeadline={titleHeadline}
              priceDisplay={priceDisplay}
              buyNowLabel={productT.buyNowShort}
              addToCartLabel={productT.addToCartShort ?? productT.addToCart}
              buyBusy={buyBusy}
              cartBusy={cartBusy}
              availableStock={availableStock}
              buyDisabled={
                buyBusy ||
                availableStock <= 0 ||
                bookingCheckoutBlocked ||
                bookingSlotRequired ||
                bookingSeatsRequired
              }
              cartDisabled={
                cartBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingCheckoutLive
              }
              onBuyNow={buyNow}
              onAddToCart={addToCart}
              brandedStorefront={brandedStorefront ?? false}
              ariaLabel={t(productT.stickyBuyHint)}
            />
          ) : null}
        </div>

        {colorMeta.length > 0 ? (
          <ProductListingColorPicker
            colorMeta={colorMeta}
            showColorSwatches={showColorSwatches}
            selectedColor={selectedColor}
            onSelectColor={selectColor}
            colorLabel={productT.colorLabel}
            optionLabel={productT.optionLabel}
            variants={variants}
            customColumns={customColumns}
            selection={shopperSelection}
            listingPriceCents={listingPriceCents}
            variantPricing={variantPricing}
            basePriceCents={basePriceCents}
            sizeOptions={sizeOptions}
            brandedStorefront={brandedStorefront ?? false}
            className="mx-1 sm:mx-0"
          />
        ) : null}
        {colorMeta.length > 0 ? (
          <p className="mx-1 hidden text-center text-[11px] leading-snug text-zinc-500 sm:mx-0 lg:block lg:text-left dark:text-zinc-400">
            {productT.gallery.colorPreviewHint}
          </p>
        ) : null}

        {arModel ? (
          <Button
            size="lg"
            variant="outline"
            className="hidden border-zinc-300 text-zinc-900 hover:bg-zinc-50 sm:inline-flex dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => setShowAr(true)}
          >
            {productT.viewInAR}
          </Button>
        ) : null}

        <MobilePdpBuyPanel
          ref={mobilePurchaseRef}
          className="relative z-30 lg:hidden"
          hidePurchaseControls={bookingCheckoutLive}
          titleHeadline={titleHeadline}
          titleSubline={titleSubline}
          categoryEyebrow={categoryEyebrow}
          listingPriceEur={listingPriceEur}
          activeRetailPriceEur={compareRetailPriceEur}
          hasRetailCompare={hasRetailCompare}
          salesCount={salesCount ?? 0}
          reviewAverage={reviewSummary.average}
          reviewCount={reviewSummary.count}
          colorMeta={colorMeta}
          showColorSwatches={showColorSwatches}
          brandedStorefront={brandedStorefront ?? false}
          hideColorPicker
          selectedColor={selectedColor}
          onSelectColor={selectColor}
          storageOptions={storageOptions}
          selectedStorage={selectedStorage}
          onSelectStorage={setSelectedStorage}
          isStorageOptionDisabled={(cap) => {
            const row = findVariantRowForShopperSelection({
              variants,
              customColumns,
              selection: {
                selectedPrimary: selectedColor,
                selectedStorage: cap,
                selectedSize,
              },
            })
            return row != null && row.stock <= 0
          }}
          sizeOptions={sizeOptions}
          selectedSize={selectedSize}
          onSelectSize={setSelectedSize}
          availableStock={availableStock}
          purchaseQty={purchaseQty}
          onQuantityChange={setPurchaseQty}
          cartBusy={cartBusy}
          buyBusy={buyBusy}
          onAddToCart={addToCart}
          onBuyNow={buyNow}
          buyNowLineSubtotalCents={buyNowLineSubtotalCents}
          priceFluidityNote={productT.priceFluidityNote}
          buyerRewardBadge={buyerRewardBadge}
          reduceMotion={reduceMotion ?? false}
          productId={productId}
          lastStockCheck={lastStockCheck}
          lastStockStatus={lastStockStatus}
          flashPercent={flashPercent}
          flashPrice={displayFlashPriceEur}
          flashEndsAt={flashEndsAt}
          isBattleWinner={isBattleWinner}
          priceReferenceEur={priceReferenceEur}
          battleResellerName={battleResellerName}
          buyerShipToCountry={buyerShipToCountry}
          shippingCarrierIds={shipping.shippingCarrierIds}
          shipFromCountry={shipping.shippingCountryCode}
          deliveryMin={shipping.deliveryMin}
          deliveryMax={shipping.deliveryMax}
          shippingMethods={shipping.shippingMethods}
          crossSocialProof={crossSocialProof}
          formatReviewCount={formatStoreCount}
          labels={{
            colorLabel: productT.colorLabel,
            optionLabel: productT.optionLabel,
            storageLabel: productT.storageLabel,
            sizeLabel: productT.sizeLabel,
            priceLabel: productT.priceLabel,
            addToCart: productT.addToCart,
            buyNowShort: productT.buyNowShort,
            inStock: productT.inStock,
            outOfStock: productT.outOfStock,
            quantityOption: (count) => t(productT.quantityOption, { count }),
            quantityAria: productT.quantityAria,
            reviews: (count) => t(productT.reviews, { count }),
          }}
        />
        {bookingCheckoutLive ? (
          <BookingCheckoutPanel
            className="relative z-30 px-4 pb-3 lg:hidden"
            productId={productId}
            listingKind={listingKind ?? "PHYSICAL"}
            selectedSlotId={selectedBookingSlotId}
            onSelectSlot={handleSelectBookingSlot}
            selectedSeatLabels={selectedSeatLabels}
            onChangeSeatLabels={setSelectedSeatLabels}
            onMapReady={setSlotUsesNamedSeats}
            experienceBookingLive={experienceBookingLive}
            serviceBookingLive={serviceBookingLive}
            multiGuestBookingLive={multiGuestBookingLive}
            slotUsesNamedSeats={slotUsesNamedSeats}
            bookingSlotRequired={bookingSlotRequired}
            bookingSeatsRequired={bookingSeatsRequired}
            purchaseQty={purchaseQty}
            onQuantityChange={setPurchaseQty}
            bookingTicketStock={bookingTicketStock}
            listingPriceEur={listingPriceEur}
            activeRetailPriceEur={compareRetailPriceEur}
            hasRetailCompare={hasRetailCompare}
            buyNowLineSubtotalCents={buyNowLineSubtotalCents}
            buyBusy={buyBusy}
            onBuyNow={buyNow}
            brandedStorefront={brandedStorefront ?? false}
            reduceMotion={reduceMotion ?? false}
            buyerRewardBadge={buyerRewardBadge}
            labels={bookingCheckoutLabels}
          />
        ) : null}
        <div className="px-4 pb-3 lg:hidden">
          {tryOnReady ? (
            <TryOnTrigger
              className="mb-3 w-full"
              variant={tryOnVariant}
              onOpen={() => setTryOnOpen(true)}
            />
          ) : null}
          <ListingLogisticsStrip logistics={shipping} compact />
        </div>
      </section>
    </motion.div>
  )
}
