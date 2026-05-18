"use client"

import { ChevronDown } from "lucide-react"

import {
  clampPurchaseQuantity,
  purchaseQuantityOptions,
} from "@/lib/marketplace-purchase-quantity"
import { cn } from "@/lib/utils"

type Props = {
  quantity: number
  onQuantityChange: (qty: number) => void
  availableStock: number
  inStockLabel: string
  outOfStockLabel: string
  quantityOptionLabel: (count: number) => string
  quantityAriaLabel: string
  className?: string
  disabled?: boolean
}

export function MarketplacePurchaseQuantity({
  quantity,
  onQuantityChange,
  availableStock,
  inStockLabel,
  outOfStockLabel,
  quantityOptionLabel,
  quantityAriaLabel,
  className,
  disabled = false,
}: Props) {
  const inStock = availableStock > 0
  const options = purchaseQuantityOptions(availableStock)
  const safeQty = clampPurchaseQuantity(quantity, availableStock)

  return (
    <div className={cn("space-y-2", className)}>
      <p
        className={cn(
          "text-sm font-medium",
          inStock ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}
      >
        {inStock ? inStockLabel : outOfStockLabel}
      </p>
      <div className="relative">
        <select
          id="listing-purchase-qty"
          aria-label={quantityAriaLabel}
          disabled={disabled || !inStock}
          value={safeQty}
          onChange={(e) => onQuantityChange(Number(e.target.value))}
          className={cn(
            "h-11 w-full appearance-none rounded-full border border-zinc-300 bg-zinc-50/90 pl-4 pr-10 text-sm font-medium text-zinc-900 shadow-sm outline-none transition",
            "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-violet-500"
          )}
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {quantityOptionLabel(n)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
          aria-hidden
        />
      </div>
    </div>
  )
}
