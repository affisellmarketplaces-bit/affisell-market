"use client"

import { BadgeCheck, Globe2, MapPin, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react"
import { isUsMarket } from "@/lib/market-config"
import { useLocale, useTranslations } from "next-intl"

import type { AppLocale } from "@/lib/i18n-locale"
import type { ListingLogisticsInput } from "@/lib/listing-logistics-display"
import {
  deliveryRangeLabel,
  listingShipsFromLabel,
  warehouseZoneKey,
} from "@/lib/listing-logistics-display"
import type { ListingSellerTrust } from "@/lib/listing-seller-trust.server"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { cn } from "@/lib/utils"

type Props = {
  logistics: ListingLogisticsInput
  className?: string
  compact?: boolean
  /** Verified-merchant facts; omit to hide the trust row. */
  trust?: ListingSellerTrust
}

export function ListingLogisticsStrip({ logistics, className, compact = false, trust }: Props) {
  const tTrust = useTranslations("pdpTrust")
  const locale = useLocale()
  const t = useTranslations("Product.logistics")
  const shipsFrom = listingShipsFromLabel(logistics)
  const zone = warehouseZoneKey(logistics.warehouseType)
  const delivery =
    logistics.deliveryMin != null && logistics.deliveryMax != null
      ? deliveryRangeLabel(logistics.deliveryMin, logistics.deliveryMax, locale as AppLocale)
      : null

  const zoneLabel = zone
    ? t(zone === "regional" && isUsMarket() ? "zone.regionalUs" : `zone.${zone}`)
    : t("zone.unknown")

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40",
        compact ? "p-2.5" : "rounded-2xl p-3",
        className
      )}
    >
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <MapPin className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("shipsFrom")}
          </span>
          <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">{shipsFrom}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 border-l border-zinc-200/80 pl-2 dark:border-zinc-700">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <PackageCheck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("deliversTo")}
          </span>
          <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">
            {logistics.deliveryCountriesSummary}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 border-l border-zinc-200/80 pl-2 dark:border-zinc-700">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Globe2 className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("zoneLabel")}
          </span>
          <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">{zoneLabel}</span>
        </div>
        {delivery ? (
        <div
            className={cn(
              "flex min-w-0 flex-col gap-1",
              compact
                ? "col-span-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-700"
                : "border-l border-zinc-200/80 pl-2 dark:border-zinc-700 max-sm:col-span-2 max-sm:border-l-0 max-sm:border-t max-sm:pt-2 max-sm:pl-0"
            )}
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Truck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
              {t("delivery")}
            </span>
            <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">{delivery}</span>
          </div>
        ) : null}
      </div>
      {/* Trust row: only facts we can stand behind — verified identity (KYC) and site-wide buyer policies. */}
      <ul
        className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-zinc-200/80 pt-2.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        aria-label={tTrust("aria")}
      >
        {trust?.verified ? (
          <li className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
            {trust.legalName
              ? tTrust("verifiedNamed", {
                  name: trust.legalName,
                  country: trust.countryCode ? visitorCountryDisplayName(trust.countryCode, locale) : "",
                })
              : tTrust("verified")}
          </li>
        ) : null}
        <li className="inline-flex items-center gap-1.5">
          <RotateCcw className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          {tTrust("returns")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          {tTrust("payment")}
        </li>
      </ul>
    </div>
  )
}
