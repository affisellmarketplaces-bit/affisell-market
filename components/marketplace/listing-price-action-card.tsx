"use client"

import { motion } from "framer-motion"
import { Clock, MousePointerClick, Sparkles } from "lucide-react"

import { FlexiblePaymentBadge } from "@/components/checkout/flexible-payment-badge"
import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { cn } from "@/lib/utils"

type Props = {
  priceLabel: string
  listingPriceEur: number
  activeRetailPriceEur: number | null
  hasRetailCompare: boolean
  buyerRewardBadge: string | null
  buyNowLineSubtotalCents: number
  buyBusy: boolean
  availableStock: number
  onBuyNow: () => void
  priceFluidityNote: string
  buyNowShort: string
  reduceMotion?: boolean
  className?: string
}

export function ListingPriceActionCard({
  priceLabel,
  listingPriceEur,
  activeRetailPriceEur,
  hasRetailCompare,
  buyerRewardBadge,
  buyNowLineSubtotalCents,
  buyBusy,
  availableStock,
  onBuyNow,
  priceFluidityNote,
  buyNowShort,
  reduceMotion = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "listing-price-card-sheen relative max-w-full overflow-hidden rounded-2xl border border-zinc-200/80",
        "bg-gradient-to-br from-white via-violet-50/30 to-white p-4 shadow-sm",
        "dark:border-zinc-700/80 dark:from-zinc-900 dark:via-violet-950/20 dark:to-zinc-950 sm:p-5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/10"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between lg:gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-violet-700/90 dark:text-violet-300/90">
            {priceLabel}
          </p>
          <div className="mt-1">
            <ProductPriceOffer
              price={listingPriceEur}
              compareAt={hasRetailCompare ? activeRetailPriceEur : null}
              layout="detail"
            />
          </div>
          {buyerRewardBadge ? (
            <p className="mt-3">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-teal-200/90 bg-teal-50/90 px-3 py-1.5 text-xs font-semibold text-teal-900 shadow-sm dark:border-teal-800 dark:bg-teal-950/70 dark:text-teal-100">
                <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                <span className="truncate">Store offer · {buyerRewardBadge}</span>
              </span>
            </p>
          ) : null}
          <FlexiblePaymentBadge amountCents={buyNowLineSubtotalCents} className="mt-2.5" />
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-2.5 border-t border-zinc-200/70 pt-4 lg:w-[10.25rem] lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 dark:border-zinc-700/80">
          <motion.button
            type="button"
            disabled={buyBusy || availableStock <= 0}
            whileHover={{ scale: availableStock > 0 && !buyBusy ? 1.02 : 1 }}
            whileTap={{ scale: availableStock > 0 && !buyBusy ? 0.98 : 1 }}
            onClick={() => onBuyNow()}
            className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-semibold text-white shadow-md shadow-violet-500/25 ring-1 ring-white/15 transition hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-white/10"
          >
            <span
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.22)_50%,transparent_70%)] opacity-0 transition-opacity duration-500 hover:opacity-100"
              aria-hidden
            />
            <MousePointerClick className="relative h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="relative">{buyBusy ? "Redirecting…" : buyNowShort}</span>
          </motion.button>

          <p
            className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2.5 text-[10px] font-medium leading-snug text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/30 dark:text-amber-100"
            role="note"
          >
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <span className="min-w-0 flex-1">
              {priceFluidityNote}
              {!reduceMotion ? (
                <span className="mt-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800/90 dark:text-amber-200/90">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/55 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                  </span>
                  Live listing
                </span>
              ) : null}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
