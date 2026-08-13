"use client"

import { ListingPriceActionCard } from "@/components/marketplace/listing-price-action-card"
import { TryOnTrigger } from "@/components/try-on/TryOnEntry"

type Props = {
  className?: string
  brandedStorefront: boolean
  priceLabel: string
  listingPriceEur: number
  compareRetailPriceEur: number | null
  hasRetailCompare: boolean
  buyerRewardBadge?: string | null
  buyNowLineSubtotalCents: number
  buyBusy: boolean
  availableStock: number
  onBuyNow: () => void
  priceFluidityNote: string
  buyNowShort: string
  reduceMotion: boolean
  lastStockCheck?: string | Date | null
  lastStockStatus?: string | null
  flashPercent?: number | null
  flashPrice?: number | null
  flashEndsAt?: string | null
  isBattleWinner?: boolean
  priceReferenceEur?: number | null
  battleResellerName?: string | null
  tryOnReady?: boolean
  tryOnVariant?: "default" | "immersive"
  onTryOnOpen?: () => void
}

export function PriceBlock({
  className,
  brandedStorefront,
  priceLabel,
  listingPriceEur,
  compareRetailPriceEur,
  hasRetailCompare,
  buyerRewardBadge,
  buyNowLineSubtotalCents,
  buyBusy,
  availableStock,
  onBuyNow,
  priceFluidityNote,
  buyNowShort,
  reduceMotion,
  lastStockCheck,
  lastStockStatus,
  flashPercent,
  flashPrice,
  flashEndsAt,
  isBattleWinner,
  priceReferenceEur,
  battleResellerName,
  tryOnReady,
  tryOnVariant,
  onTryOnOpen,
}: Props) {
  return (
    <>
      <ListingPriceActionCard
        className={className}
        brandedStorefront={brandedStorefront}
        priceLabel={priceLabel}
        listingPriceEur={listingPriceEur}
        activeRetailPriceEur={compareRetailPriceEur}
        hasRetailCompare={hasRetailCompare}
        buyerRewardBadge={buyerRewardBadge ?? null}
        buyNowLineSubtotalCents={buyNowLineSubtotalCents}
        buyBusy={buyBusy}
        availableStock={availableStock}
        onBuyNow={onBuyNow}
        priceFluidityNote={priceFluidityNote}
        buyNowShort={buyNowShort}
        reduceMotion={reduceMotion}
        lastStockCheck={lastStockCheck}
        lastStockStatus={lastStockStatus}
        flashPercent={flashPercent}
        flashPrice={flashPrice}
        flashEndsAt={flashEndsAt}
        isBattleWinner={isBattleWinner}
        priceReferenceEur={priceReferenceEur}
        battleResellerName={battleResellerName}
      />
      {tryOnReady && onTryOnOpen ? (
        <TryOnTrigger
          className="max-lg:hidden w-full"
          variant={tryOnVariant ?? "default"}
          onOpen={onTryOnOpen}
        />
      ) : null}
    </>
  )
}
