"use client"

import { ChevronDown, FileText, Package, Star, Truck } from "lucide-react"
import { motion } from "framer-motion"
import { formatStoreCount } from "@/lib/market-config"
import type { ListingShippingBlock, SpecRow } from "../listing-detail-types"

type Props = {
  reduceMotion: boolean | null
  reviewSummary: { count: number; average: number }
  ratingBreakdown?: Record<number, number>
  productSpecs: SpecRow[]
  colorNames: string[]
  shipping: ListingShippingBlock
  descriptionFooterExcerpt: string | null
}

export function ListingDetailsPanel({
  reduceMotion,
  reviewSummary,
  ratingBreakdown,
  productSpecs,
  colorNames,
  shipping,
  descriptionFooterExcerpt,
}: Props) {
  return (
    <motion.div
      initial={reduceMotion ? false : { y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-950/80 dark:ring-white/[0.04]"
      aria-label="Product details"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-violet-50/80 via-white to-teal-50/40 px-4 py-2.5 dark:border-zinc-800 dark:from-violet-950/30 dark:via-zinc-950 dark:to-teal-950/20">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          Details
        </p>
        <span className="text-[10px] font-medium tabular-nums text-zinc-400 dark:text-zinc-500">
          {reviewSummary.count > 0
            ? `${reviewSummary.average.toFixed(1)}★ · ${formatStoreCount(reviewSummary.count)}`
            : "No reviews yet"}
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        <details
          id="listing-description-footer"
          className="group scroll-mt-28 [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
              Description
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
            {descriptionFooterExcerpt ? (
              <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">{descriptionFooterExcerpt}</p>
            ) : (
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">No written description for this listing.</p>
            )}
            <a
              href="#product-description"
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
            >
              Full story in About this product
              <span aria-hidden>↑</span>
            </a>
          </div>
        </details>
        <details
          id="listing-specs"
          className="group scroll-mt-28 [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
              Specifications
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/30">
            {productSpecs.length > 0 ? (
              <dl className="grid gap-x-4 gap-y-2.5">
                {productSpecs.map((row) => (
                  <div
                    key={`${row.label}:${row.value.slice(0, 32)}`}
                    className="grid grid-cols-[minmax(0,38%)_1fr] gap-x-2 gap-y-0.5 border-b border-zinc-100/80 pb-2 last:border-0 last:pb-0 dark:border-zinc-800/80"
                  >
                    <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{row.label}</dt>
                    <dd className="text-xs text-zinc-900 dark:text-zinc-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <ul
              className={`space-y-1 text-xs text-zinc-700 dark:text-zinc-300 ${productSpecs.length > 0 ? "mt-3 border-t border-dashed border-zinc-200/80 pt-3 dark:border-zinc-700" : ""}`}
            >
              <li>Colour options: {colorNames.length || "—"}</li>
              <li>Average rating: {reviewSummary.average.toFixed(1)} / 5</li>
            </ul>
          </div>
        </details>
        <details className="group [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
              Shipping
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <p className="border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
            Delivery {shipping.deliveryMin}-{shipping.deliveryMax} business days. Processing in{" "}
            {shipping.processingTime} day(s).
          </p>
        </details>
        <details
          id="listing-reviews-summary"
          className="group scroll-mt-28 [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
              Reviews snapshot
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
            <p className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">
              {reviewSummary.average.toFixed(1)} ({formatStoreCount(reviewSummary.count)} reviews)
            </p>
            {ratingBreakdown ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                5★: {ratingBreakdown[5] ?? 0} · 4★: {ratingBreakdown[4] ?? 0} · 3★:{" "}
                {ratingBreakdown[3] ?? 0}
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </motion.div>
  )
}
