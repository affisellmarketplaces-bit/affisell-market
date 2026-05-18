"use client"

import { Sparkles, Truck } from "lucide-react"

import {
  affiliateMarginEur,
  affiliateMarginTone,
  affiliateMarginToneClass,
  formatAffiliateCatalogPreviewLine,
  illustrativePublicPriceEur,
} from "@/lib/supplier-sku-affiliate-earning"
import { formatStoreCurrency } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  supplierPriceEur: number
  commissionPct: number
  compareAtEur?: number | null
  shipsFrom?: string
  deliveryDays?: number | null
  warehouseCode?: string | null
  processingDays?: number | null
  weightGrams?: number | null
  shippingCostEur?: number
  freeShipping?: boolean
  className?: string
}

export function SupplierSimulationCard({
  supplierPriceEur,
  commissionPct,
  compareAtEur,
  shipsFrom,
  deliveryDays,
  warehouseCode,
  processingDays,
  weightGrams,
  shippingCostEur = 0,
  freeShipping,
  className,
}: Props) {
  const supplier = supplierPriceEur > 0 ? supplierPriceEur : 0
  const rate = Math.min(100, Math.max(0, Math.round(commissionPct) || 0))
  const publicEur = supplier > 0 ? illustrativePublicPriceEur({ supplierPrice: supplier, commissionRate: rate, compareAtEur }) : 0
  const affiliateMargin = supplier > 0 ? affiliateMarginEur({ supplierPrice: supplier, commissionRate: rate, compareAtEur }) : 0
  const tone = affiliateMarginTone(affiliateMargin)
  const supplierNet = supplier > 0 ? Math.round(supplier * 100) / 100 : 0

  const previewLine =
    supplier > 0
      ? formatAffiliateCatalogPreviewLine({
          supplierPriceEur: supplier,
          commissionRate: rate,
          compareAtEur,
          weightGrams,
          processingDays,
          warehouseCode,
          shipsFrom,
          deliveryDays,
        })
      : null

  const warehouse = (warehouseCode ?? shipsFrom ?? "EU").trim().toUpperCase() || "EU"
  const shipDays = processingDays ?? deliveryDays ?? 2

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-white p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-zinc-950",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/25">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">Simulation live</p>
          <p className="mt-0.5 text-xs text-violet-900/75 dark:text-violet-300/85">
            Estimation pour les affiliés — le prix client final reste libre.
          </p>
        </div>
      </div>

      {supplier <= 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Indiquez votre prix catalogue pour voir les marges.
        </p>
      ) : (
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Votre prix catalogue</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatStoreCurrency(supplier)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Prix public illustratif</dt>
            <dd className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
              {formatStoreCurrency(publicEur)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Commission offerte</dt>
            <dd className="font-medium tabular-nums text-violet-800 dark:text-violet-200">{rate}%</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-violet-100 pt-3 dark:border-violet-900/50">
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Marge affilié (est.)</dt>
            <dd className={cn("font-bold tabular-nums", affiliateMarginToneClass(tone))}>
              {formatStoreCurrency(affiliateMargin)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Vous recevez / vente</dt>
            <dd className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatStoreCurrency(supplierNet)}
            </dd>
          </div>
        </dl>
      )}

      {previewLine ? (
        <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-xs font-medium leading-relaxed text-violet-900/90 dark:bg-zinc-900/60 dark:text-violet-200/90">
          {previewLine}
        </p>
      ) : null}

      <div className="mt-4 flex items-start gap-2 border-t border-violet-100 pt-3 text-xs text-zinc-600 dark:border-violet-900/40 dark:text-zinc-400">
        <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          Expédition depuis {warehouse} · {shipDays} j
          {freeShipping ? " · Livraison gratuite" : shippingCostEur > 0 ? ` · ${formatStoreCurrency(shippingCostEur)}` : ""}
        </p>
      </div>
    </div>
  )
}
