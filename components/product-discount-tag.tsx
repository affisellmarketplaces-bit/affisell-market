import { cn } from "@/lib/utils"

type ProductDiscountTagProps = {
  percent: number
  className?: string
}

/**
 * Compact deal signal on product imagery — top-right, clear of wishlist & sales badges.
 */
export function ProductDiscountTag({ percent, className }: ProductDiscountTagProps) {
  const pct = Math.max(1, Math.min(99, Math.round(percent)))

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-2.5 top-11 z-[18] sm:right-3 sm:top-12",
        className
      )}
      aria-label={`${pct}% off`}
      role="img"
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-2.5 py-1",
          "bg-gradient-to-r from-rose-600 via-rose-500 to-violet-600",
          "text-[11px] font-bold tabular-nums tracking-tight text-white",
          "shadow-md shadow-rose-500/25 ring-1 ring-inset ring-white/25"
        )}
      >
        −{pct}%
      </span>
    </div>
  )
}
