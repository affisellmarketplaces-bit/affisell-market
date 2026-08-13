"use client"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  findVariantRowForShopperSelection,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import type { ProductVariantsJson } from "@/lib/product-variants"
import type { CustomColumn } from "@/types/product"

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
}: Props) {
  if (storageOptions.length === 0) return null

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
              onClick={() => onSelectStorage(cap)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                selectedStorage === cap
                  ? brandedChipSelected
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              } ${out ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <span className="block leading-tight">{cap}</span>
              <span
                className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                  selectedStorage === cap ? "text-white/90" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {formatStoreCurrencyFromCents(optionCents)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
