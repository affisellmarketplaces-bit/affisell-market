"use client"

import { motion } from "framer-motion"
import nextDynamic from "next/dynamic"
import { RotateCcw, ShieldCheck } from "lucide-react"
import { ListingLogisticsStrip } from "@/components/product/listing-logistics-strip"
import type { ListingDetailController } from "../use-listing-detail-controller"
import type { ListingDetailProps, ListingShippingBlock, StorefrontInfo } from "../listing-detail-types"
import { t } from "../listing-detail-utils"
import { ProductInfo } from "./ProductInfo"
import { TrustBadges } from "./TrustBadges"
import { PriceBlock } from "./PriceBlock"
import { VariantSelector } from "./VariantSelector"
import { SizeSelector } from "./SizeSelector"
import { ListingPurchaseDock } from "./ListingPurchaseDock"
import { ListingDetailsPanel } from "./ListingDetailsPanel"
import { ListingStorefrontCard } from "./ListingStorefrontCard"

const BookingComingSoonRail = nextDynamic(
  () =>
    import("@/components/booking/booking-coming-soon-rail").then((m) => ({
      default: m.BookingComingSoonRail,
    })),
  { loading: () => null }
)

type Props = Pick<
  ListingDetailProps,
  | "audience"
  | "productId"
  | "listingKind"
  | "name"
  | "partnerLabel"
  | "sellerLabel"
  | "isVerifiedSupplier"
  | "supplierTrustTier"
  | "offerBadge"
  | "brandedStorefront"
  | "storageOptions"
  | "variants"
  | "listingPriceCents"
  | "basePriceCents"
  | "colorNames"
  | "productSpecs"
  | "ratingBreakdown"
  | "lastStockCheck"
  | "lastStockStatus"
  | "flashPercent"
  | "flashEndsAt"
  | "isBattleWinner"
  | "priceReferenceEur"
  | "battleResellerName"
  | "buyerRewardBadge"
  | "buyerShipToCountry"
  | "salesCount"
  | "reviewSummary"
  | "viewsLast24h"
  | "affiliateCreatorsWatching"
  | "crossSocialProof"
  | "compactCrossSellSlot"
> & {
  ctrl: ListingDetailController
  shipping: ListingShippingBlock
  storefront: StorefrontInfo | null
  customColumns: import("@/types/product").CustomColumn[]
}

export function ListingSidebarColumn({
  audience = "customer",
  productId,
  listingKind = "PHYSICAL",
  name,
  partnerLabel,
  sellerLabel,
  isVerifiedSupplier = false,
  supplierTrustTier,
  offerBadge,
  brandedStorefront = false,
  storageOptions = [],
  variants,
  listingPriceCents,
  basePriceCents,
  colorNames,
  productSpecs = [],
  ratingBreakdown,
  lastStockCheck,
  lastStockStatus,
  flashPercent,
  flashEndsAt,
  isBattleWinner,
  priceReferenceEur,
  battleResellerName,
  buyerRewardBadge,
  buyerShipToCountry,
  salesCount = 0,
  reviewSummary,
  viewsLast24h = 0,
  affiliateCreatorsWatching = 0,
  crossSocialProof = null,
  compactCrossSellSlot,
  shipping,
  storefront,
  customColumns,
  ctrl,
}: Props) {
  const {
    brand,
    reduceMotion,
    productT,
    messages,
    titleHeadline,
    titleSubline,
    titleSublineLong,
    titleExpanded,
    setTitleExpanded,
    categoryEyebrow,
    availableStock,
    partnerHighlightLabel,
    selectedStorage,
    setSelectedStorage,
    selectedSize,
    setSelectedSize,
    sizeOptions,
    isShoeProduct,
    sizeTip,
    shopperSelection,
    activeListingPriceCents,
    listingPriceEur,
    compareRetailPriceEur,
    hasRetailCompare,
    buyNowLineSubtotalCents,
    buyBusy,
    buyNow,
    bookingCheckoutBlocked,
    bookingCheckoutLive,
    tryOnReady,
    tryOnVariant,
    setTryOnOpen,
    purchaseDockRef,
    purchaseQty,
    setPurchaseQty,
    selectedBookingSlotId,
    handleSelectBookingSlot,
    selectedSeatLabels,
    setSelectedSeatLabels,
    setSlotUsesNamedSeats,
    experienceBookingLive,
    serviceBookingLive,
    multiGuestBookingLive,
    slotUsesNamedSeats,
    bookingSlotRequired,
    bookingSeatsRequired,
    bookingTicketStock,
    bookingCheckoutLabels,
    rewardBalanceCents,
    maxApplicableReward,
    useRewardCents,
    setUseRewardCents,
    cartBusy,
    addToCart,
    alertSaved,
    savePriceAlert,
    etaDate,
    deliveryPlace,
    displayFlashPriceEur,
  } = ctrl

  return (
    <aside className="order-3 min-w-0 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:row-span-2 lg:sticky lg:top-28 lg:self-start lg:space-y-4">
      <div className="max-lg:divide-y max-lg:divide-zinc-100 max-lg:overflow-hidden max-lg:rounded-xl max-lg:border max-lg:border-zinc-200/90 max-lg:bg-white max-lg:shadow-sm dark:max-lg:divide-zinc-800 dark:max-lg:border-zinc-800 dark:max-lg:bg-zinc-950">
        <div className="hidden space-y-2.5 lg:block lg:pt-3 lg:pb-3">
          <ProductInfo
            brand={brand}
            reduceMotion={reduceMotion}
            brandedStorefront={brandedStorefront}
            isVerifiedSupplier={isVerifiedSupplier}
            supplierTrustTier={supplierTrustTier}
            partnerLabel={partnerLabel}
            storefrontName={storefront?.name}
            productT={productT}
            offerBadge={offerBadge}
            titleHeadline={titleHeadline}
            titleSubline={titleSubline}
            titleSublineLong={titleSublineLong}
            titleExpanded={titleExpanded}
            onToggleTitleExpanded={() => setTitleExpanded((v) => !v)}
            categoryEyebrow={categoryEyebrow}
            availableStock={availableStock}
            freeShippingThresholdEUR={shipping.freeShippingThresholdEUR}
          />

          <TrustBadges
            audience={audience}
            brand={brand}
            salesCount={salesCount}
            reviewSummary={reviewSummary}
            productT={productT}
            viewsLast24h={viewsLast24h}
            affiliateCreatorsWatching={affiliateCreatorsWatching}
          />

          {bookingCheckoutBlocked ? (
            <BookingComingSoonRail listingKind={listingKind} className="max-lg:hidden" />
          ) : !bookingCheckoutLive ? (
            <PriceBlock
              className="max-lg:hidden"
              brandedStorefront={brandedStorefront}
              priceLabel={productT.priceLabel}
              listingPriceEur={listingPriceEur}
              compareRetailPriceEur={compareRetailPriceEur}
              hasRetailCompare={hasRetailCompare}
              buyerRewardBadge={buyerRewardBadge}
              buyNowLineSubtotalCents={buyNowLineSubtotalCents}
              buyBusy={buyBusy}
              availableStock={availableStock}
              onBuyNow={buyNow}
              priceFluidityNote={productT.priceFluidityNote}
              buyNowShort={productT.buyNowShort}
              reduceMotion={reduceMotion ?? false}
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
              tryOnReady={tryOnReady}
              tryOnVariant={tryOnVariant}
              onTryOnOpen={() => setTryOnOpen(true)}
              crossSocialProof={crossSocialProof}
            />
          ) : null}
        </div>

        <div className="hidden space-y-2 px-4 py-2.5 lg:block lg:space-y-4 lg:px-0 lg:py-0">
          {availableStock <= 5 && availableStock > 0 ? (
            <p className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 lg:rounded-xl lg:py-2 lg:text-sm">
              {t(productT.onlyLeft, { count: Math.max(1, availableStock) })}
            </p>
          ) : null}

          <ListingLogisticsStrip logistics={shipping} className="lg:rounded-2xl" />
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/40 lg:rounded-2xl lg:p-3">
            <div className="flex flex-col items-center gap-1 px-1">
              <RotateCcw className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Returns
              </span>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{productT.return30d}</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-l border-zinc-200/80 px-1 dark:border-zinc-700">
              <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Checkout
              </span>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{productT.securePayment}</span>
            </div>
          </div>
          <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 lg:-mt-3 lg:text-xs">
            {t(productT.deliveryTo, {
              city: deliveryPlace,
              date: etaDate,
            })}
          </p>
        </div>

        <div className="hidden space-y-3 px-4 py-3 lg:block lg:space-y-4 lg:px-0 lg:py-0">
          {partnerHighlightLabel ? (
            <p className={brand.partnerHighlight}>
              <span className="font-semibold">Partner highlight:</span> {partnerHighlightLabel}
            </p>
          ) : null}

          <VariantSelector
            storageOptions={storageOptions}
            selectedStorage={selectedStorage}
            onSelectStorage={setSelectedStorage}
            storageLabel={productT.storageLabel}
            variants={variants}
            customColumns={customColumns}
            selection={shopperSelection}
            listingPriceCents={listingPriceCents}
            basePriceCents={basePriceCents}
            activeListingPriceCents={activeListingPriceCents}
            brandedChipSelected={brand.chipSelected}
          />

          <SizeSelector
            sizeOptions={sizeOptions}
            selectedSize={selectedSize}
            onSelectSize={setSelectedSize}
            sizeLabel={productT.sizeLabel}
            isShoeProduct={isShoeProduct}
            productName={name}
            sizeTip={sizeTip}
            brandedChipSelected={brand.chipSelected}
          />
        </div>

        <ListingPurchaseDock
          purchaseDockRef={purchaseDockRef}
          reduceMotion={reduceMotion}
          brand={brand}
          listingKind={listingKind}
          bookingCheckoutBlocked={bookingCheckoutBlocked}
          bookingCheckoutLive={bookingCheckoutLive}
          productId={productId}
          selectedBookingSlotId={selectedBookingSlotId}
          onSelectBookingSlot={handleSelectBookingSlot}
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
          compareRetailPriceEur={compareRetailPriceEur}
          hasRetailCompare={hasRetailCompare}
          buyNowLineSubtotalCents={buyNowLineSubtotalCents}
          buyBusy={buyBusy}
          onBuyNow={buyNow}
          brandedStorefront={brandedStorefront}
          buyerRewardBadge={buyerRewardBadge}
          bookingCheckoutLabels={bookingCheckoutLabels}
          shipping={shipping}
          productT={productT}
          rewardBalanceCents={rewardBalanceCents}
          maxApplicableReward={maxApplicableReward}
          useRewardCents={useRewardCents}
          onUseRewardChange={setUseRewardCents}
          availableStock={availableStock}
          cartBusy={cartBusy}
          onAddToCart={addToCart}
          alertSaved={alertSaved}
          onSavePriceAlert={savePriceAlert}
          compactCrossSellSlot={compactCrossSellSlot}
          wishlistTitle={messages.wishlist.title}
          affiliateCommissionnaireName={partnerLabel ?? storefront?.name ?? ""}
          supplierName={sellerLabel}
        />
      </div>

      <ListingDetailsPanel
        reduceMotion={reduceMotion}
        reviewSummary={reviewSummary}
        ratingBreakdown={ratingBreakdown}
        productSpecs={productSpecs}
        colorNames={colorNames}
        shipping={shipping}
        descriptionFooterExcerpt={ctrl.descriptionFooterExcerpt}
      />

      <ListingStorefrontCard
        audience={audience}
        storefront={storefront}
        partnerLabel={partnerLabel}
        productT={productT}
      />
    </aside>
  )
}
