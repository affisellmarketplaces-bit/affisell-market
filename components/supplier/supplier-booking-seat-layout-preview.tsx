"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"

import {
  buildSeatLayout,
  gridColumnCount,
  type BookingSeatLayoutConfig,
} from "@/lib/booking/seat-layout"
import { cn } from "@/lib/utils"

type Props = {
  config: BookingSeatLayoutConfig
  capacity: number
  className?: string
}

export function SupplierBookingSeatLayoutPreview({ config, capacity, className }: Props) {
  const t = useTranslations("supplier.booking.seatLayout")
  const seats = useMemo(() => buildSeatLayout(capacity, config), [capacity, config])
  const gridCols = gridColumnCount(config)
  const maxRow = Math.max(0, ...seats.map((s) => s.rowIndex))

  return (
    <div className={cn("rounded-xl border border-white/10 bg-black/30 p-3", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{t("previewTitle")}</p>
      <p className="mt-1 text-xs text-cyan-100/75">{t("previewHint")}</p>
      <div
        className="mx-auto mt-3 max-w-md rounded-t-lg border border-cyan-400/30 bg-gradient-to-b from-cyan-500/20 to-transparent px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200"
        aria-hidden
      >
        {t("screenLabel")}
      </div>
      <div
        className="mt-2 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${maxRow + 1}, minmax(0, 1fr))`,
        }}
      >
        {seats.map((seat) => (
          <span
            key={seat.label}
            style={{ gridColumn: seat.displayColIndex + 1, gridRow: seat.rowIndex + 1 }}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border text-[8px] font-semibold",
              seat.blocked
                ? "border-zinc-500/60 bg-zinc-800/50 text-zinc-500"
                : seat.tier === "VIP"
                  ? "border-violet-400/60 bg-violet-500/25 text-violet-100"
                  : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
            )}
            title={seat.label}
          >
            {seat.blocked ? "♿" : seat.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-cyan-100/80">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-emerald-400/40 bg-emerald-500/15" aria-hidden />
          {t("legendStandard")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-violet-400/60 bg-violet-500/25" aria-hidden />
          {t("legendVip")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-zinc-500/60 bg-zinc-800/50" aria-hidden />
          {t("legendBlocked")}
        </span>
      </div>
    </div>
  )
}
