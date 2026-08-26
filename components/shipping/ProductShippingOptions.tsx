"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import type { Carrier } from "@/lib/shipping/carriers"
import {
  resolveSupplierCarrierOffers,
  type SupplierCarrierOffer,
  type SupplierCarrierOfferSlot,
} from "@/lib/shipping/supplier-carrier-offers-shared"
import { cn } from "@/lib/utils"

type Props = {
  /** Buyer ship-to ISO2 */
  country?: string | null
  /** Supplier ship-from ISO2 */
  shipFromCountry?: string | null
  carrierIds?: string[]
  deliveryMin?: number
  deliveryMax?: number
  shippingMethods?: string[]
  className?: string
}

function CarrierLogo({ carrier }: { carrier: Carrier }) {
  const [broken, setBroken] = useState(false)
  const initial = carrier.name.trim().charAt(0).toUpperCase() || "?"

  if (broken || !carrier.logo) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
        style={{ backgroundColor: carrier.color || "#6d28d9" }}
        aria-hidden
      >
        {initial}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={carrier.logo}
      alt=""
      className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-violet-200/80 dark:bg-zinc-900 dark:ring-violet-800/60"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

const SLOT_ACCENT: Record<SupplierCarrierOfferSlot, string> = {
  fastest: "ring-1 ring-violet-300/80 dark:ring-violet-700/50",
  balanced: "ring-1 ring-indigo-300/80 dark:ring-indigo-800/50",
  cheapest: "ring-1 ring-emerald-300/80 dark:ring-emerald-900/50",
}

function CarrierRow({ offer, label }: { offer: SupplierCarrierOffer; label: string }) {
  const { carrier, deliveryMin, deliveryMax } = offer
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border border-violet-200/60 bg-white/95 px-3 py-2.5 shadow-sm dark:border-violet-900/40 dark:bg-zinc-950/80",
        SLOT_ACCENT[offer.slot]
      )}
    >
      <CarrierLogo carrier={carrier} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">
            {label}
          </p>
          <p className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {carrier.reliability}%
          </p>
        </div>
        <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {carrier.name}
        </p>
        <p className="text-[11px] tabular-nums text-zinc-500">
          {deliveryMin}–{deliveryMax}j
        </p>
      </div>
    </div>
  )
}

/** PDP strip — supplier-configured carriers with Affisell fastest / recommended / cheapest badges. */
export function ProductShippingOptions({
  country = "FR",
  shipFromCountry = null,
  carrierIds = [],
  deliveryMin = 2,
  deliveryMax = 5,
  shippingMethods = ["standard"],
  className,
}: Props) {
  const t = useTranslations("shipping")
  const locale = useLocale()
  const buyerCountry = (country?.trim() || "FR").toUpperCase()

  const offers = useMemo(
    () =>
      resolveSupplierCarrierOffers({
        carrierIds,
        buyerCountry,
        shipFromCountry,
        deliveryMin,
        deliveryMax,
        shippingMethods,
      }),
    [buyerCountry, carrierIds, deliveryMax, deliveryMin, shipFromCountry, shippingMethods]
  )

  const labelForSlot = (slot: SupplierCarrierOfferSlot): string => {
    if (slot === "fastest") return t("fastest")
    if (slot === "balanced") return t("balanced")
    return t("cheapest")
  }

  if (offers.length === 0) return null

  return (
    <div className={cn("@container/ship mt-3 space-y-2", className)} lang={locale}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
          {t("pdpOptionsTitle")}
        </p>
        <Link
          href="/shipping/verify"
          className="shrink-0 text-[11px] font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          {t("verify")}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 @[36rem]/grid-cols-3">
        {offers.map((offer) => (
          <CarrierRow key={offer.slot} offer={offer} label={labelForSlot(offer.slot)} />
        ))}
      </div>
    </div>
  )
}
