"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import type { PublicSeatCell } from "@/lib/booking/named-seats"
import type { SeatLayoutPreset } from "@/lib/booking/seat-layout"
import { cn } from "@/lib/utils"

type SeatMapLayout = {
  preset: SeatLayoutPreset
  gridCols: number
  aisleAfterCols: number[]
  vipRowIndices: number[]
}

type Props = {
  productId: string
  slotId: string
  selectedLabels: string[]
  onChangeLabels: (labels: string[]) => void
  onMapReady?: (hasNamedSeats: boolean) => void
  className?: string
}

export function BookingNamedSeatPicker({
  productId,
  slotId,
  selectedLabels,
  onChangeLabels,
  onMapReady,
  className,
}: Props) {
  const t = useTranslations("Product.booking")
  const [seats, setSeats] = useState<PublicSeatCell[]>([])
  const [layout, setLayout] = useState<SeatMapLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(
        `/api/booking/seats?slotId=${encodeURIComponent(slotId)}&productId=${encodeURIComponent(productId)}`,
        { cache: "no-store" }
      )
      if (!res.ok) {
        setSeats([])
        setError(true)
        return
      }
      const data = (await res.json()) as {
        seats?: PublicSeatCell[]
        layout?: SeatMapLayout
      }
      const rows = Array.isArray(data.seats) ? data.seats : []
      setSeats(rows)
      setLayout(data.layout ?? null)
      onMapReady?.(rows.length > 0)
    } catch {
      setSeats([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [productId, slotId, onMapReady])

  useEffect(() => {
    void load()
  }, [load])

  const gridCols = useMemo(() => {
    if (layout?.gridCols) return layout.gridCols
    if (seats.length === 0) return 8
    return Math.max(4, ...seats.map((s) => (s.displayColIndex ?? s.colIndex) + 1))
  }, [layout, seats])

  const maxRow = useMemo(() => Math.max(0, ...seats.map((s) => s.rowIndex)), [seats])
  const isCinema = layout?.preset === "CINEMA_VIP"

  function toggleSeat(seat: PublicSeatCell) {
    if (seat.status !== "OPEN") return
    const selected = selectedLabels.includes(seat.label)
    if (selected) {
      onChangeLabels(selectedLabels.filter((l) => l !== seat.label))
      return
    }
    onChangeLabels([...selectedLabels, seat.label].sort())
  }

  if (loading) {
    return (
      <div className={cn("mt-4 flex items-center gap-2 text-sm text-cyan-200/80", className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t("loadingSeatMap")}
      </div>
    )
  }

  if (error || seats.length === 0) return null

  return (
    <div className={cn("mt-4 rounded-xl border border-white/10 bg-black/30 p-3", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{t("seatMapTitle")}</p>
      <p className="mt-1 text-xs text-cyan-100/75">
        {isCinema ? t("seatMapCinemaHint") : t("seatMapNamedHint")}
      </p>
      {isCinema ? (
        <div
          className="mx-auto mt-3 max-w-lg rounded-t-lg border border-cyan-400/30 bg-gradient-to-b from-cyan-500/20 to-transparent px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200"
          aria-hidden
        >
          {t("seatMapScreen")}
        </div>
      ) : null}
      <div
        className="mt-2 grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridTemplateRows: isCinema ? `repeat(${maxRow + 1}, minmax(0, 1fr))` : undefined,
        }}
      >
        {seats.map((seat) => {
          const isYours = selectedLabels.includes(seat.label)
          const isOpen = seat.status === "OPEN"
          const isBlocked = seat.status === "BLOCKED"
          const isVip = seat.tier === "VIP"
          const displayCol = seat.displayColIndex ?? seat.colIndex
          return (
            <button
              key={seat.label}
              type="button"
              disabled={!isOpen && !isYours}
              onClick={() => toggleSeat(seat)}
              style={
                isCinema
                  ? { gridColumn: displayCol + 1, gridRow: seat.rowIndex + 1 }
                  : undefined
              }
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-[9px] font-semibold transition",
                isBlocked
                  ? "cursor-not-allowed border-zinc-600/80 bg-zinc-800/60 text-zinc-500"
                  : seat.status === "BOOKED" || seat.status === "HELD"
                    ? "cursor-not-allowed border-zinc-600/80 bg-zinc-700/60 text-zinc-400"
                    : isYours
                      ? "border-amber-400/80 bg-amber-400/35 text-amber-100 ring-1 ring-amber-300/50"
                      : isVip
                        ? "border-violet-400/60 bg-violet-500/20 text-violet-100 hover:bg-violet-500/35"
                        : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/30"
              )}
              aria-pressed={isYours}
              aria-label={t("seatLabelAria", {
                label: seat.label,
                status: isBlocked ? "BLOCKED" : seat.status,
              })}
            >
              {isBlocked ? "♿" : seat.label}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-cyan-100/80">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-400/40 bg-emerald-500/20" aria-hidden />
          {t("seatMapFree")}
        </span>
        {isCinema ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-violet-400/60 bg-violet-500/20" aria-hidden />
            {t("seatMapVip")}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-400/80 bg-amber-400/35" aria-hidden />
          {t("seatMapYours")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-zinc-600/80 bg-zinc-700/60" aria-hidden />
          {t("seatMapTaken")}
        </span>
      </div>
      {selectedLabels.length > 0 ? (
        <p className="mt-3 text-xs text-amber-200/90">
          {t("selectedSeats", { labels: selectedLabels.join(", "), count: selectedLabels.length })}
        </p>
      ) : (
        <p className="mt-3 text-xs text-amber-200/80">{t("selectSeatsRequired")}</p>
      )}
    </div>
  )
}
