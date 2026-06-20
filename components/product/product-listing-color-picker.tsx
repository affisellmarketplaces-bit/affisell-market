"use client"

import type { MobilePdpColorMeta } from "@/components/product/mobile-pdp-buy-panel"
import { ProductColorSwatchButton } from "@/components/product/product-color-swatch-button"
import { shopperColorLabelsMatch } from "@/lib/marketplace-color-meta"
import {
  findVariantRowForShopperSelection,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  marketplaceSellingPriceCentsForOption,
  type ProductVariantsJson,
} from "@/lib/product-variants"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import type { CustomColumn } from "@/types/product"
import { cn } from "@/lib/utils"

type Props = {
  colorMeta: MobilePdpColorMeta[]
  showColorSwatches: boolean
  selectedColor: string | null
  onSelectColor: (name: string) => void
  colorLabel: string
  variants: ProductVariantsJson | null | undefined
  customColumns: CustomColumn[]
  selection: ShopperVariantSelection
  listingPriceCents: number
  basePriceCents: number
  sizeOptions: string[]
  brandedStorefront?: boolean
  className?: string
}

export function ProductListingColorPicker({
  colorMeta,
  showColorSwatches,
  selectedColor,
  onSelectColor,
  colorLabel,
  variants,
  customColumns,
  selection,
  listingPriceCents,
  basePriceCents,
  sizeOptions,
  brandedStorefront = false,
  className,
}: Props) {
  if (colorMeta.length === 0) return null

  const brand = storefrontPdpBrandClasses(brandedStorefront)

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/90 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-3.5 sm:py-3 lg:rounded-2xl lg:px-4 lg:py-3.5",
        className
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 lg:text-xs lg:tracking-[0.12em]">
          {showColorSwatches ? colorLabel : "Option"}
        </p>
        {selectedColor ? (
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 lg:text-sm">
            {selectedColor}
          </p>
        ) : null}
      </div>

      {showColorSwatches ? (
        <div className="mt-2 flex gap-2.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {colorMeta.map(({ name: colorName, meta, imageUrl }) => (
            <ProductColorSwatchButton
              key={colorName}
              name={colorName}
              meta={meta ?? { name: colorName, hex: "#8E8E93" }}
              imageUrl={imageUrl}
              selected={shopperColorLabelsMatch(selectedColor, colorName)}
              selectedClassName={brand.swatchSelectedRing}
              unselectedClassName="border-zinc-300 hover:scale-105 hover:border-zinc-500 dark:border-zinc-600 dark:hover:border-zinc-400"
              onClick={() => onSelectColor(colorName)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {colorMeta.map(({ name: colorName }) => {
            const matchedRow = findVariantRowForShopperSelection({
              variants: variants ?? null,
              customColumns,
              selection: {
                selectedPrimary: colorName,
                selectedStorage: selection.selectedStorage,
                selectedSize: sizeOptions.length > 0 ? selection.selectedSize : null,
              },
            })
            const out = matchedRow != null && matchedRow.stock <= 0
            const optionCents =
              matchedRow && matchedRow.priceCents > 0
                ? Math.max(
                    0,
                    listingPriceCents + (matchedRow.priceCents - Math.max(0, basePriceCents))
                  )
                : marketplaceSellingPriceCentsForOption({
                    listingSellingPriceCents: listingPriceCents,
                    productBasePriceCents: basePriceCents,
                    variants: variants ?? null,
                    optionName: colorName,
                  })
            return (
              <button
                key={colorName}
                type="button"
                disabled={out}
                onClick={() => onSelectColor(colorName)}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition active:scale-95",
                  shopperColorLabelsMatch(selectedColor, colorName)
                    ? brand.chipSelected
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600",
                  out && "cursor-not-allowed opacity-40"
                )}
              >
                <span className="block leading-tight">{colorName}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] font-semibold tabular-nums",
                    shopperColorLabelsMatch(selectedColor, colorName)
                      ? "text-white/90"
                      : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  {formatStoreCurrencyFromCents(optionCents)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
