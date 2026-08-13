"use client"

import { BadgeCheck, Package } from "lucide-react"
import { motion } from "framer-motion"
import { SupplierTrustBadge } from "@/components/suppliers/supplier-trust-badge"
import { ProductOfferBadge } from "@/components/product/product-offer-badge"
import type { OfferModeBadge } from "@/lib/product-offer-mode"
import { fmtMoney, t } from "../listing-detail-utils"

type BrandClasses = ReturnType<typeof import("@/lib/storefront-pdp-brand").storefrontPdpBrandClasses>

type Props = {
  brand: BrandClasses
  reduceMotion: boolean | null
  brandedStorefront: boolean
  isVerifiedSupplier: boolean
  supplierTrustTier?: string | null
  partnerLabel?: string
  storefrontName?: string
  productT: {
    verifiedPartnerStorefront: string
    curatedByPartner: string
    fulfilledBySupplier: string
    inStock: string
    outOfStock: string
  }
  offerBadge?: OfferModeBadge | null
  titleHeadline: string
  titleSubline: string | null
  titleSublineLong: boolean
  titleExpanded: boolean
  onToggleTitleExpanded: () => void
  categoryEyebrow: string | null
  availableStock: number
  freeShippingThresholdEUR: number | null
}

export function ProductInfo({
  brand,
  reduceMotion,
  brandedStorefront,
  isVerifiedSupplier,
  supplierTrustTier,
  partnerLabel,
  storefrontName,
  productT,
  offerBadge,
  titleHeadline,
  titleSubline,
  titleSublineLong,
  titleExpanded,
  onToggleTitleExpanded,
  categoryEyebrow,
  availableStock,
  freeShippingThresholdEUR,
}: Props) {
  return (
    <header className="space-y-2 lg:space-y-3 lg:pt-3">
      <motion.div
        className="relative"
        initial={reduceMotion ? false : { y: 8 }}
        animate={{ y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={brand.titleAccentBar} aria-hidden />
        <div className="pl-0 lg:pl-2">
          {brandedStorefront ? (
            isVerifiedSupplier || (supplierTrustTier && supplierTrustTier !== "NONE") ? (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-100">
                <BadgeCheck className="size-4 shrink-0" aria-hidden />
                {productT.verifiedPartnerStorefront}
              </span>
            ) : null
          ) : (
            <SupplierTrustBadge
              tier={supplierTrustTier}
              isVerifiedSupplier={isVerifiedSupplier}
              className="mb-2"
              size="md"
            />
          )}
          {brandedStorefront ? (
            partnerLabel || storefrontName ? (
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500 dark:text-zinc-400">{productT.curatedByPartner}</span>
                <span aria-hidden> · </span>
                <span className="text-zinc-900 dark:text-zinc-50">{partnerLabel || storefrontName}</span>
              </p>
            ) : (
              <p className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {productT.verifiedPartnerStorefront}
              </p>
            )
          ) : (
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t(productT.fulfilledBySupplier)}
            </p>
          )}
          {offerBadge ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ProductOfferBadge badge={offerBadge} variant="inline" />
            </div>
          ) : null}
        </div>
        <h1 className="text-balance pl-0 lg:pl-2">
          <span className="block text-[1.35rem] font-bold leading-[1.15] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[1.65rem]">
            {titleHeadline}
          </span>
          {titleSubline ? (
            <span
              className={`mt-2 block text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400 ${
                !titleExpanded && titleSublineLong ? "line-clamp-2" : ""
              }`}
            >
              {titleSubline}
            </span>
          ) : null}
        </h1>
        {titleSubline && titleSublineLong ? (
          <button
            type="button"
            onClick={onToggleTitleExpanded}
            className="mt-2 text-xs font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
          >
            {titleExpanded ? "Show shorter title" : "Show full title"}
          </button>
        ) : null}
      </motion.div>

      <motion.div
        className="flex flex-wrap items-center gap-2"
        initial={reduceMotion ? false : { y: 6 }}
        animate={{ y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      >
        {categoryEyebrow ? (
          <span className={brand.categoryBadge}>{categoryEyebrow}</span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <Package className="h-3.5 w-3.5" aria-hidden />
          {availableStock > 0 ? (
            <>
              {productT.inStock}
              {availableStock <= 20 ? ` · ${availableStock} left` : null}
            </>
          ) : (
            productT.outOfStock
          )}
        </span>
        {freeShippingThresholdEUR != null && freeShippingThresholdEUR > 0 ? (
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            Free shipping over {fmtMoney(freeShippingThresholdEUR)}
          </span>
        ) : null}
      </motion.div>
    </header>
  )
}
