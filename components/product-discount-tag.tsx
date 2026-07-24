import { cn } from "@/lib/utils"

type ProductDiscountTagProps = {
  percent: number
  className?: string
}

/**
 * Compact deal signal on product imagery — bottom-left, clear of wishlist & sales badges.
 */
export function ProductDiscountTag({ percent, className }: ProductDiscountTagProps) {
  const pct = Math.max(1, Math.min(99, Math.round(percent)))

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 z-[18]",
        className
      )}
      aria-label={`${pct}% off`}
      role="img"
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-2.5 py-1 backdrop-blur-md",
          "bg-[linear-gradient(135deg,rgba(244,63,94,0.92),rgba(217,70,239,0.9),rgba(124,58,237,0.92))]",
          "text-[10px] font-bold tabular-nums tracking-tight text-white",
          "shadow-[0_10px_22px_-10px_rgba(244,63,94,0.75)] ring-1 ring-inset ring-white/35"
        )}
      >
        −{pct}%
      </span>
    </div>
  )
}
