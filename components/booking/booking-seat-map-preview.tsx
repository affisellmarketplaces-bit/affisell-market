"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type Props = {
  capacity: number
  occupiedSeats: number
  selectedQty: number
  className?: string
}

const MAX_VISIBLE_SEATS = 80

export function BookingSeatMapPreview({ capacity, occupiedSeats, selectedQty, className }: Props) {
  const t = useTranslations("Product.booking")
  const total = Math.max(1, capacity)
  const occupied = Math.min(total, Math.max(0, occupiedSeats))
  const selected = Math.min(Math.max(0, selectedQty), Math.max(0, total - occupied))
  const visible = Math.min(total, MAX_VISIBLE_SEATS)
  const truncated = total > MAX_VISIBLE_SEATS

  const cells = Array.from({ length: visible }, (_, i) => {
    if (i < occupied) return "taken" as const
    if (i < occupied + selected) return "yours" as const
    return "free" as const
  })

  return (
    <div className={cn("mt-4 rounded-xl border border-white/10 bg-black/30 p-3", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{t("seatMapTitle")}</p>
      <p className="mt-1 text-xs text-cyan-100/75">{t("seatMapHint")}</p>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(10, Math.max(4, Math.ceil(Math.sqrt(visible))))}, minmax(0, 1fr))` }}
        role="img"
        aria-label={t("seatMapAria", { free: total - occupied, total })}
      >
        {cells.map((state, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-md border",
              state === "taken" && "border-zinc-600/80 bg-zinc-700/60",
              state === "yours" && "border-amber-400/80 bg-amber-400/35 ring-1 ring-amber-300/50",
              state === "free" && "border-emerald-400/40 bg-emerald-500/20"
            )}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-cyan-100/80">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-400/40 bg-emerald-500/20" aria-hidden />
          {t("seatMapFree")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-400/80 bg-amber-400/35" aria-hidden />
          {t("seatMapYours")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-zinc-600/80 bg-zinc-700/60" aria-hidden />
          {t("seatMapTaken")}
        </span>
      </div>
      {truncated ? (
        <p className="mt-2 text-[11px] text-cyan-200/60">{t("seatMapTruncated", { total })}</p>
      ) : null}
    </div>
  )
}
