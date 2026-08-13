"use client"

import { ShoeSizeGuideTrigger } from "@/components/product/ShoeSizeGuide"

type Props = {
  sizeOptions: string[]
  selectedSize: string | null
  onSelectSize: (size: string) => void
  sizeLabel: string
  isShoeProduct: boolean
  productName: string
  sizeTip?: string | null
  brandedChipSelected?: string
}

export function SizeSelector({
  sizeOptions,
  selectedSize,
  onSelectSize,
  sizeLabel,
  isShoeProduct,
  productName,
  sizeTip,
  brandedChipSelected,
}: Props) {
  if (sizeOptions.length === 0) return null

  const selectedClass =
    brandedChipSelected ??
    "bg-violet-600 text-white border-violet-600 shadow-[0_2px_10px_rgba(124,58,237,0.3)]"

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
        {sizeOptions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelectSize(s)}
            className={`min-w-[58px] h-10 rounded-xl border px-3 text-sm font-medium transition ${
              selectedSize === s
                ? selectedClass
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {sizeTip ? (
        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-100 lg:rounded-xl lg:text-sm">
          {sizeTip}
        </p>
      ) : null}
    </div>
  )
}
