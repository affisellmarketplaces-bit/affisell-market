"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Suspense } from "react"
import nextDynamic from "next/dynamic"
import { ListingBrowseSignalsRecorder } from "@/components/marketplace/listing-browse-signals-recorder"
import { OutOfStockModal } from "@/components/checkout/OutOfStockModal"
import { MobilePdpPersistentBuyBar } from "@/components/product/mobile-pdp-persistent-buy-bar"
import { appMessagesForLocale } from "@/lib/i18n-app-messages"
import { useLocale } from "next-intl"
import type { AppLocale } from "@/lib/i18n-locale"
import { ListingBreadcrumbNav } from "./components/ListingBreadcrumbNav"
import { ListingGalleryColumn } from "./components/ListingGalleryColumn"
import { ListingSidebarColumn } from "./components/ListingSidebarColumn"
import { ListingAboutSection } from "./components/ListingAboutSection"
import type { ListingDetailProps } from "./listing-detail-types"
import { useListingDetailController } from "./use-listing-detail-controller"
import { t } from "./listing-detail-utils"

export type { ListingShippingBlock } from "./listing-detail-types"

const ReviewsEngine = nextDynamic(
  () => import("@/components/reviews/ReviewsEngine").then((m) => ({ default: m.ReviewsEngine })),
  { loading: () => null }
)
const TryOnModal = nextDynamic(
  () => import("@/components/try-on/TryOnModal").then((m) => ({ default: m.TryOnModal })),
  { ssr: false, loading: () => null }
)

export function MarketplaceListingDetail(props: ListingDetailProps) {
  const {
    audience = "customer",
    listingId,
    productId,
    name,
    description,
    descriptionBullets = [],
    descriptionIllustrationImages = [],
    descriptionIllustrationVideos = [],
    categories,
    crossSellFooterSlot,
    writeReviewOrderId = null,
    openWriteReview = false,
    ratingBreakdown,
    reviewSummary,
    arModel,
    tryOnGarmentUrl,
  } = props

  const locale = useLocale() as AppLocale
  const messages = appMessagesForLocale(locale)
  const reduceMotion = useReducedMotion()
  const ctrl = useListingDetailController(props)
  const {
    brand,
    productT,
    ghostOos,
    setGhostOos,
    mobilePurchaseRef,
    tryOnOpen,
    setTryOnOpen,
    tryOnReady,
    titleHeadline,
    priceDisplay,
    availableStock,
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
    descExpanded,
    setDescExpanded,
    descriptionIsLong,
    descriptionGalleryImages,
    glanceText,
    identitySheet,
  } = ctrl

  return (
    <>
      {audience === "customer" && categories.length > 0 ? (
        <ListingBrowseSignalsRecorder categories={categories} />
      ) : null}
      <div className="relative mb-10 max-w-full max-lg:overflow-x-clip max-lg:pb-24 lg:mb-14 lg:overflow-visible">
        <motion.div className={brand.cardGlowOrb} aria-hidden />
        <motion.div className={brand.cardGlowOrbTeal} aria-hidden />
        <motion.div
          initial={reduceMotion ? false : { y: 20 }}
          animate={{ y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] }
          }
          className="relative max-w-full max-lg:overflow-x-clip overflow-y-visible rounded-2xl border border-white/75 bg-white/80 p-2 shadow-[0_36px_120px_-40px_rgba(91,33,217,0.32),0_0_0_1px_rgba(255,255,255,0.55)_inset] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7 lg:overflow-visible lg:p-9 dark:border-white/[0.08] dark:bg-zinc-950/65 dark:shadow-[0_40px_120px_-48px_rgba(0,0,0,0.65)]"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_-8%,rgba(139,92,246,0.16),transparent_58%)] dark:bg-[radial-gradient(120%_85%_at_50%_-8%,rgba(167,139,250,0.14),transparent_58%)]"
            aria-hidden
          />
          <motion.div className="relative grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-12 lg:items-start lg:gap-x-12 lg:gap-y-8">
            <ListingBreadcrumbNav key="listing-breadcrumb" homeLabel={messages.Breadcrumb.home} categories={categories} />
            <ListingGalleryColumn
              key="listing-gallery"
              {...props}
              customColumns={ctrl.safeCustomColumns}
              shipping={props.shipping}
              mobilePurchaseRef={mobilePurchaseRef}
              ctrl={ctrl}
            />
            <ListingSidebarColumn
              key="listing-sidebar"
              {...props}
              customColumns={ctrl.safeCustomColumns}
              shipping={props.shipping}
              ctrl={ctrl}
            />
            <ListingAboutSection
              key="listing-about"
              reduceMotion={reduceMotion}
              description={description}
              descriptionBullets={descriptionBullets}
              descriptionIllustrationImages={descriptionIllustrationImages}
              descriptionGalleryImages={descriptionGalleryImages}
              descriptionIllustrationVideos={descriptionIllustrationVideos}
              productId={productId}
              glanceText={glanceText}
              descriptionIsLong={descriptionIsLong}
              descExpanded={descExpanded}
              onToggleDescExpanded={() => setDescExpanded((v) => !v)}
              reviewCount={reviewSummary.count}
              productT={productT}
            />
          </motion.div>
        </motion.div>
      </div>

      <section className="mt-12 max-w-full overflow-x-clip border-t border-zinc-200/80 pt-10 dark:border-zinc-800">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          }
        >
          <ReviewsEngine
            productId={productId}
            productName={name}
            listingId={listingId}
            initialSummary={{
              averageRating: reviewSummary.average,
              reviewCount: reviewSummary.count,
              ugcCount: reviewSummary.ugcCount ?? 0,
              distribution: ratingBreakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            }}
            canWriteReview={Boolean(writeReviewOrderId)}
            writeReviewOrderId={writeReviewOrderId}
            openWriteOnMount={openWriteReview}
          />
        </Suspense>
      </section>

      {crossSellFooterSlot ? (
        <div className="mt-12 max-w-full" data-testid="listing-cross-sell-footer">
          {crossSellFooterSlot}
        </div>
      ) : null}

      {showAr ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">AR Preview</h3>
              <button
                type="button"
                onClick={() => setShowAr(false)}
                className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            {arModel ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Open the model in a new tab for AR-enabled viewer.
                </p>
                <a
                  href={arModel}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Open AR Model
                </a>
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No AR model available.</p>
            )}
          </div>
        </div>
      ) : null}

      {!bookingCheckoutLive && !showAr ? (
        <MobilePdpPersistentBuyBar
          placement="dock"
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
          brandedStorefront={props.brandedStorefront ?? false}
          ariaLabel={t(productT.stickyBuyHint)}
        />
      ) : null}
      {identitySheet}
      <OutOfStockModal open={Boolean(ghostOos)} payload={ghostOos} onClose={() => setGhostOos(null)} />
      {tryOnReady ? (
        <TryOnModal
          open={tryOnOpen}
          onClose={() => setTryOnOpen(false)}
          productId={productId}
          affiliateProductId={listingId}
          productName={name}
          garmentUrl={tryOnGarmentUrl!.trim()}
        />
      ) : null}
    </>
  )
}
