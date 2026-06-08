"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import type { PublicSeatCell } from "@/lib/booking/named-seats"
import { cn } from "@/lib/utils"

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
      const data = (await res.json()) as { seats?: PublicSeatCell[] }
      const rows = Array.isArray(data.seats) ? data.seats : []
      setSeats(rows)
      onMapReady?.(rows.length > 0)
    } catch {
      setSeats([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [productId, slotId])

  useEffect(() => {
    void load()
  }, [load])

  const colCount = useMemo(() => {
    if (seats.length === 0) return 8
    return Math.max(4, ...seats.map((s) => s.colIndex + 1))
  }, [seats])

  function toggleSeat(label: string, status: PublicSeatCell["status"]) {
    if (status !== "OPEN") return
    const selected = selectedLabels.includes(label)
    if (selected) {
      onChangeLabels(selectedLabels.filter((l) => l !== label))
      return
    }
    onChangeLabels([...selectedLabels, label].sort())
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
      <p className="mt-1 text-xs text-cyan-100/75">{t("seatMapNamedHint")}</p>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {seats.map((seat) => {
          const isYours = selectedLabels.includes(seat.label)
          const isOpen = seat.status === "OPEN"
          return (
            <button
              key={seat.label}
              type="button"
              disabled={!isOpen && !isYours}
              onClick={() => toggleSeat(seat.label, seat.status)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-[9px] font-semibold transition",
                seat.status === "BOOKED" || seat.status === "HELD"
                  ? "cursor-not-allowed border-zinc-600/80 bg-zinc-700/60 text-zinc-400"
                  : isYours
                    ? "border-amber-400/80 bg-amber-400/35 text-amber-100 ring-1 ring-amber-300/50"
                    : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/30"
              )}
              aria-pressed={isYours}
              aria-label={t("seatLabelAria", { label: seat.label, status: seat.status })}
            >
              {seat.label}
            </button>
          )
        })}
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
