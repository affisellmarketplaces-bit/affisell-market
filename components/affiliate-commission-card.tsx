"use client"

import Link from "next/link"

import { formatStoreCurrency } from "@/lib/market-config"
import type { ProductVariantLine } from "@/lib/product-variants"

export type AffiliateCommissionCardProps = {
  variant: ProductVariantLine
  /** Fallback list price in major storefront currency units when variant has no override */
  basePriceEur: number
}

export function AffiliateCommissionCard({ variant, basePriceEur }: AffiliateCommissionCardProps) {
  const priceEur =
    variant.priceCents > 0 ? variant.priceCents / 100 : Math.max(0, basePriceEur)
  const commissionPct =
    typeof variant.commission === "number" && Number.isFinite(variant.commission)
      ? variant.commission
      : 15
  const earning = priceEur * (commissionPct / 100)
  const isHigh = commissionPct >= 20
  const isHot = variant.sales > 10

  return (
    <div
      className={`relative rounded-xl border-2 p-3 ${
        isHigh
          ? "border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
      }`}
    >
      {isHigh ? (
        <div className="absolute -top-2 -right-2 animate-pulse rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
          HIGH COMM
        </div>
      ) : null}
      {isHot ? (
        <div className="absolute -top-2 left-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
          Hot · {variant.sales} sold
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{variant.name}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatStoreCurrency(earning)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            You earn • {commissionPct}%
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-zinc-500">Price</p>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            {formatStoreCurrency(priceEur)}
          </p>
          <Link
            href="/dashboard/affiliate"
            className="mt-1.5 inline-block rounded-lg bg-black px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Promote
          </Link>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-zinc-200 pt-2.5 text-center dark:border-zinc-700">
        {[
          { sales: 10, label: "10 sales" },
          { sales: 50, label: "50 sales" },
          { sales: 100, label: "100 sales" },
        ].map((tier) => (
          <div key={tier.sales}>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{tier.label}</p>
            <p className="text-sm font-bold text-green-700 dark:text-green-400">
              {formatStoreCurrency(earning * tier.sales, { maximumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
