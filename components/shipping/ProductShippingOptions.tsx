"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"

import type { Carrier } from "@/lib/shipping/carriers"
import {
  resolvePdpShippingOffers,
  type PdpShippingOffer,
  type ShopShippingOffer,
} from "@/lib/shipping/supplier-carrier-offers-shared"
import { cn } from "@/lib/utils"

type Props = {
  /** Buyer ship-to ISO2 */
  country?: string | null
  /** The supplier's shop shipping profile. Empty → this component renders NOTHING. */
  shopOffers?: readonly ShopShippingOffer[]
  /** Product-level subset of the shop carriers (optional). */
  carrierIds?: readonly string[]
  className?: string
}

function CarrierMonogram({ carrier }: { carrier: Carrier }) {
  const initial = carrier.name.trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
      style={{ backgroundColor: carrier.color || "#6d28d9" }}
      aria-hidden
    >
      {initial}
    </span>
  )
}

function CarrierRow({ offer }: { offer: PdpShippingOffer }) {
  const t = useTranslations("shipping")
  const { carrier, deliveryMin, deliveryMax, fastest } = offer
  const days =
    deliveryMin === deliveryMax
      ? t("deliveryDaysExact", { count: deliveryMax })
      : t("deliveryDays", { min: deliveryMin, max: deliveryMax })

  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border bg-white/95 px-3 py-2.5 shadow-sm dark:bg-zinc-950/80",
        fastest
          ? "border-violet-300/80 ring-1 ring-violet-200/70 dark:border-violet-700/60 dark:ring-violet-900/50"
          : "border-zinc-200/80 dark:border-zinc-800"
      )}
    >
      <CarrierMonogram carrier={carrier} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{carrier.name}</p>
          {fastest ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
              {t("fastest")}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-zinc-500 dark:text-zinc-400">
          <span>{t(`carrierType.${carrier.type}`)}</span>
          <span aria-hidden>·</span>
          <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-200">{days}</span>
        </p>
      </div>
    </li>
  )
}

/**
 * PDP shipping block. Everything shown — carriers and delivery windows — was defined by the supplier in their
 * shop shipping profile. No suggestion, no fallback, no Affisell-invented rating: no profile → nothing rendered.
 */
export function ProductShippingOptions({ country = "FR", shopOffers = [], carrierIds = [], className }: Props) {
  const t = useTranslations("shipping")
  const locale = useLocale()
  const buyerCountry = (country?.trim() || "FR").toUpperCase()

  const offers = useMemo(
    () => resolvePdpShippingOffers({ shopOffers, productCarrierIds: carrierIds, buyerCountry }),
    [shopOffers, carrierIds, buyerCountry]
  )

  if (offers.length === 0) return null

  return (
    <div className={cn("mt-3 space-y-2", className)} lang={locale}>
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
      <ul className="grid grid-cols-1 gap-2">
        {offers.map((offer) => (
          <CarrierRow key={offer.carrier.id} offer={offer} />
        ))}
      </ul>
    </div>
  )
}
