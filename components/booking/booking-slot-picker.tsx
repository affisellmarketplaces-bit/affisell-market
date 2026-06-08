"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Loader2, Scissors } from "lucide-react"
import { useTranslations } from "next-intl"

import type { PublicBookingSlotRow } from "@/lib/booking/slot-availability"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  selectedSlotId: string | null
  onSelectSlot: (slotId: string | null) => void
  className?: string
}

export function BookingSlotPicker({ productId, selectedSlotId, onSelectSlot, className }: Props) {
  const t = useTranslations("Product.booking")
  const [slots, setSlots] = useState<PublicBookingSlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/booking/slots?productId=${encodeURIComponent(productId)}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        setError("load_failed")
        setSlots([])
        return
      }
      const data = (await res.json()) as { slots?: PublicBookingSlotRow[] }
      setSlots(Array.isArray(data.slots) ? data.slots : [])
    } catch {
      setError("load_failed")
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      className={cn(
        "rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-cyan-950/95 via-slate-950 to-violet-950 p-5 text-white shadow-[0_0_60px_-24px_rgba(6,182,212,0.55)]",
        className
      )}
    >
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
        <Scissors className="h-3.5 w-3.5" aria-hidden />
        {t("pickerTitle")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-cyan-100/90">{t("pickerHint")}</p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-cyan-200/80">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("loadingSlots")}
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-300">{t("loadError")}</p>
      ) : slots.length === 0 ? (
        <p className="mt-4 text-sm text-amber-200/90">{t("noSlots")}</p>
      ) : (
        <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          {slots.map((slot) => {
            const selected = selectedSlotId === slot.id
            const starts = new Date(slot.startsAt)
            const label = slot.label ?? starts.toLocaleString()
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  onClick={() => onSelectSlot(selected ? null : slot.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    selected
                      ? "border-cyan-400 bg-cyan-500/20 ring-2 ring-cyan-400/40"
                      : "border-white/10 bg-black/25 hover:border-cyan-400/40 hover:bg-cyan-950/40"
                  )}
                >
                  <CalendarClock className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-white">{label}</span>
                    <span className="text-xs text-cyan-200/70">
                      {t("seatsLeft", { count: slot.seatsLeft })}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
