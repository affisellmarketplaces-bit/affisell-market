import { cn } from "@/lib/utils"

type ProductDiscountTagProps = {
  percent: number
  className?: string
}

/** Corner hangtag — small, rotated, does not cover the product image. */
export function ProductDiscountTag({ percent, className }: ProductDiscountTagProps) {
  const pct = Math.max(1, Math.min(99, Math.round(percent)))

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 top-0 z-20 h-14 w-14 overflow-visible",
        className
      )}
      aria-hidden
    >
      <div
        className="absolute left-1 top-2 origin-top-left -rotate-12"
        style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))" }}
      >
        <div className="relative">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-400/90 ring-2 ring-white dark:ring-zinc-900" />
          <div
            className={cn(
              "absolute left-0.5 top-1 min-w-[2.75rem] rounded-sm border border-red-700/20",
              "bg-gradient-to-br from-red-500 to-red-600 px-1.5 py-1 text-center",
              "shadow-sm"
            )}
          >
            <span className="block text-[8px] font-bold uppercase leading-none tracking-wide text-white/95">
              Save
            </span>
            <span className="mt-0.5 block text-[11px] font-black leading-none tabular-nums text-white">
              {pct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
