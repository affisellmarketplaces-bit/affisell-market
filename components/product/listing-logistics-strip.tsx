"use client"

import { Globe2, MapPin, Truck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import type { ListingLogisticsInput } from "@/lib/listing-logistics-display"
import {
  deliveryRangeLabel,
  listingShipsFromLabel,
  warehouseZoneKey,
} from "@/lib/listing-logistics-display"
import { cn } from "@/lib/utils"

type Props = {
  logistics: ListingLogisticsInput
  className?: string
  compact?: boolean
}

export function ListingLogisticsStrip({ logistics, className, compact = false }: Props) {
  const locale = useLocale()
  const t = useTranslations("Product.logistics")
  const shipsFrom = listingShipsFromLabel(logistics)
  const zone = warehouseZoneKey(logistics.warehouseType)
  const delivery = deliveryRangeLabel(logistics.deliveryMin, logistics.deliveryMax, locale)

  const zoneLabel = zone ? t(`zone.${zone}`) : t("zone.unknown")

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40",
        compact ? "p-2.5" : "rounded-2xl p-3",
        className
      )}
    >
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <MapPin className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("shipsFrom")}
          </span>
          <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">{shipsFrom}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 border-l border-zinc-200/80 pl-2 dark:border-zinc-700">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Globe2 className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("zoneLabel")}
          </span>
          <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">{zoneLabel}</span>
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-col gap-1",
            compact ? "col-span-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-700" : "border-l border-zinc-200/80 pl-2 dark:border-zinc-700 max-sm:col-span-2 max-sm:border-l-0 max-sm:border-t max-sm:pt-2 max-sm:pl-0"
          )}
        >
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Truck className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("delivery")}
          </span>
          <span className="text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">{delivery}</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">{t("supplierNote")}</p>
    </div>
  )
}
