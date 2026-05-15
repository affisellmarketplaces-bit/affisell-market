import { cn } from "@/lib/utils"

type ProductDiscountTagProps = {
  percent: number
  className?: string
}

/** Corner deal ribbon — compact, on-brand, does not cover the product hero. */
export function ProductDiscountTag({ percent, className }: ProductDiscountTagProps) {
  const pct = Math.max(1, Math.min(99, Math.round(percent)))

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 top-0 z-20 size-[3.25rem] overflow-hidden",
        className
      )}
      aria-label={`${pct}% off`}
      role="img"
    >
      <div
        className="absolute -left-[46%] -top-[46%] h-[140%] w-[140%] rotate-45"
        style={{
          background:
            "linear-gradient(135deg, var(--buyer) 0%, color-mix(in oklab, var(--buyer) 72%, var(--brand)) 55%, var(--brand) 100%)",
          boxShadow: "0 2px 8px color-mix(in oklab, var(--brand) 35%, transparent)",
        }}
      />
      <div
        className="absolute -left-[46%] -top-[46%] h-[140%] w-[140%] rotate-45 opacity-40"
        style={{
          background:
            "linear-gradient(90deg, transparent 42%, rgba(255,255,255,0.55) 50%, transparent 58%)",
        }}
      />
      <div className="absolute left-0 top-0 flex flex-col items-start pl-1.5 pt-1">
        <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-white/90">
          Off
        </span>
        <span className="mt-0.5 text-[13px] font-black leading-none tabular-nums tracking-tight text-white drop-shadow-sm">
          −{pct}%
        </span>
      </div>
    </div>
  )
}
