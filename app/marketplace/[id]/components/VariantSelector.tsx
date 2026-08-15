"use client"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  findVariantRowForShopperSelection,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import type { ProductVariantsJson } from "@/lib/product-variants"
import type { CustomColumn } from "@/types/product"
import { cn } from "@/lib/utils"

type Props = {
  storageOptions: string[]
  selectedStorage: string | null
  onSelectStorage: (cap: string) => void
  storageLabel: string
  variants: ProductVariantsJson | null
  customColumns: CustomColumn[]
  selection: ShopperVariantSelection
  listingPriceCents: number
  basePriceCents: number
  activeListingPriceCents: number
  brandedChipSelected: string
  unselectedChipClass?: string
  outOfStockChipClass?: string
  outOfStockLabel?: string
}

export function VariantSelector({
  storageOptions,
  selectedStorage,
  onSelectStorage,
  storageLabel,
  variants,
  customColumns,
  selection,
  listingPriceCents,
  basePriceCents,
  activeListingPriceCents,
  brandedChipSelected,
  unselectedChipClass,
  outOfStockChipClass,
  outOfStockLabel = "Épuisé",
}: Props) {
  if (storageOptions.length === 0) return null

  const defaultUnselected =
    "border-zinc-300 bg-zinc-50 text-zinc-900 hover:border-zinc-500 hover:bg-white dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-400"
  const defaultOut =
    "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
  const unselectedClass = unselectedChipClass ?? defaultUnselected
  const outClass = outOfStockChipClass ?? defaultOut

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 lg:text-sm lg:normal-case lg:tracking-normal lg:text-zinc-900 dark:lg:text-zinc-100">
          {storageLabel}
        </p>
        {selectedStorage ? (
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 lg:text-sm">
            {selectedStorage}
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {storageOptions.map((cap) => {
          const row = findVariantRowForShopperSelection({
            variants,
            customColumns,
            selection: {
              ...selection,
              selectedStorage: cap,
            },
          })
          const out = row != null && row.stock <= 0
          const optionCents =
            row && row.priceCents > 0
              ? Math.max(
                  0,
                  listingPriceCents + (row.priceCents - Math.max(0, basePriceCents))
                )
              : activeListingPriceCents
          return (
            <button
              key={cap}
              type="button"
              disabled={out}
              aria-disabled={out}
              aria-label={out ? `${storageLabel} ${cap} — ${outOfStockLabel}` : `${storageLabel} ${cap}`}
              onClick={() => onSelectStorage(cap)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition",
                selectedStorage === cap && !out ? brandedChipSelected : null,
                selectedStorage !== cap && !out ? unselectedClass : null,
                out ? outClass : null
              )}
            >
              <span className={cn("block leading-tight", out && "line-through")}>{cap}</span>
              <span
                className={cn(
                  "mt-0.5 block text-[11px] font-semibold tabular-nums",
                  selectedStorage === cap && !out
                    ? "text-white/90"
                    : out
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-500 dark:text-zinc-400"
                )}
              >
                {out ? outOfStockLabel : formatStoreCurrencyFromCents(optionCents)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
