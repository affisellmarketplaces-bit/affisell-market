"use client"

import { ShoeSizeGuideTrigger } from "@/components/product/ShoeSizeGuide"
import { cn } from "@/lib/utils"

type Props = {
  sizeOptions: string[]
  selectedSize: string | null
  onSelectSize: (size: string) => void
  sizeLabel: string
  isShoeProduct: boolean
  productName: string
  sizeTip?: string | null
  brandedChipSelected?: string
  /** When set, sizes with stock ≤ 0 are disabled and marked out of stock. */
  getOptionStock?: (size: string) => number
  outOfStockLabel?: string
  unselectedChipClass?: string
  outOfStockChipClass?: string
  showStockLegend?: boolean
  inStockLegendLabel?: string
  outOfStockLegendLabel?: string
}

const DEFAULT_UNSELECTED =
  "border-zinc-300 bg-zinc-50 text-zinc-900 shadow-sm hover:border-zinc-500 hover:bg-white dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-400"

const DEFAULT_OUT_OF_STOCK =
  "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"

export function SizeSelector({
  sizeOptions,
  selectedSize,
  onSelectSize,
  sizeLabel,
  isShoeProduct,
  productName,
  sizeTip,
  brandedChipSelected,
  getOptionStock,
  outOfStockLabel = "Épuisé",
  unselectedChipClass,
  outOfStockChipClass,
  showStockLegend = false,
  inStockLegendLabel = "Disponible",
  outOfStockLegendLabel = "Épuisé",
}: Props) {
  if (sizeOptions.length === 0) return null

  const selectedClass =
    brandedChipSelected ??
    "bg-violet-600 text-white border-violet-600 shadow-[0_2px_10px_rgba(124,58,237,0.3)]"

  const unselectedClass = unselectedChipClass ?? DEFAULT_UNSELECTED
  const outClass = outOfStockChipClass ?? DEFAULT_OUT_OF_STOCK

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 lg:text-sm lg:normal-case lg:font-semibold lg:text-zinc-900 dark:lg:text-zinc-100">
          {sizeLabel}
        </p>
        <div className="flex items-center gap-2">
          {selectedSize ? (
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 lg:text-sm">{selectedSize}</p>
          ) : null}
          {isShoeProduct ? <ShoeSizeGuideTrigger brand={productName} gender="femme" /> : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {sizeOptions.map((s) => {
          const stock = getOptionStock?.(s)
          const out = stock != null && stock <= 0
          const isSelected = selectedSize === s

          return (
            <button
              key={s}
              type="button"
              disabled={out}
              aria-disabled={out}
              aria-label={out ? `${sizeLabel} ${s} — ${outOfStockLabel}` : `${sizeLabel} ${s}`}
              title={out ? outOfStockLabel : undefined}
              onClick={() => onSelectSize(s)}
              className={cn(
                "relative min-h-10 min-w-[58px] rounded-xl border px-3 py-1.5 text-sm font-semibold transition",
                isSelected && !out ? selectedClass : null,
                !isSelected && !out ? unselectedClass : null,
                isSelected && out
                  ? cn(
                      selectedClass,
                      "opacity-75 ring-2 ring-red-300/80 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950"
                    )
                  : null,
                out && !isSelected ? outClass : null,
                !out && !isSelected && "hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              <span className={cn("block leading-tight tabular-nums", out && !isSelected && "line-through")}>
                {s}
              </span>
              {out ? (
                <span
                  className={cn(
                    "mt-0.5 block text-[9px] font-bold uppercase tracking-wide",
                    isSelected ? "text-white/90" : "text-red-600 dark:text-red-400"
                  )}
                >
                  {outOfStockLabel}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {showStockLegend && getOptionStock ? (
        <p className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            {inStockLegendLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" aria-hidden />
            {outOfStockLegendLabel}
          </span>
        </p>
      ) : null}
      {sizeTip ? (
        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-100 lg:rounded-xl lg:text-sm">
          {sizeTip}
        </p>
      ) : null}
    </div>
  )
}
