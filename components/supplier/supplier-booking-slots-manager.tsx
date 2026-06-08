"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarPlus, Loader2, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isExperienceListingKind } from "@/lib/booking/types"

type SupplierSlotRow = {
  id: string
  startsAt: string
  endsAt: string
  capacity: number
  bookedCount: number
  seatsLeft: number
  label: string | null
  status: string
}

type Props = {
  productId: string
  listingKind: string
}

export function SupplierBookingSlotsManager({ productId, listingKind }: Props) {
  const t = useTranslations("supplier.booking")
  const isExperience = isExperienceListingKind(listingKind)
  const [slots, setSlots] = useState<SupplierSlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [date, setDate] = useState("")
  const [time, setTime] = useState("10:00")
  const [label, setLabel] = useState("")
  const [capacity, setCapacity] = useState("30")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${productId}/booking-slots`, {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        setSlots([])
        return
      }
      const data = (await res.json()) as { slots?: SupplierSlotRow[] }
      setSlots(Array.isArray(data.slots) ? data.slots : [])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  async function addSlot() {
    if (!date || !time) {
      toast.error(t("slotDateTimeRequired"))
      return
    }
    const startsAt = new Date(`${date}T${time}:00`)
    if (!Number.isFinite(startsAt.getTime())) {
      toast.error(t("slotInvalidDateTime"))
      return
    }
    setBusy(true)
    try {
      const capacityN = isExperience ? Math.max(1, Math.min(500, Math.round(Number(capacity)) || 30)) : 1
      const res = await fetch(`/api/supplier/products/${productId}/booking-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          label: label.trim() || undefined,
          capacity: capacityN,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? t("slotCreateFailed"))
        return
      }
      toast.success(t("slotCreated"))
      setLabel("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function removeSlot(slotId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/supplier/products/${productId}/booking-slots/${slotId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error === "slot_has_bookings" ? t("slotHasBookings") : t("slotDeleteFailed"))
        return
      }
      toast.success(t("slotDeleted"))
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative mt-6 space-y-5 rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t("slotsTitle")}</p>
      <p className="text-xs leading-relaxed text-cyan-100/75">
        {isExperience ? t("slotsHintExperience") : t("slotsHint")}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="slot-date" className="text-cyan-100">
            {t("slotDateLabel")}
          </Label>
          <Input
            id="slot-date"
            type="date"
            className="mt-1.5 border-white/15 bg-black/30 text-white"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="slot-time" className="text-cyan-100">
            {t("slotTimeLabel")}
          </Label>
          <Input
            id="slot-time"
            type="time"
            className="mt-1.5 border-white/15 bg-black/30 text-white"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="slot-label" className="text-cyan-100">
          {t("slotLabelOptional")}
        </Label>
        <Input
          id="slot-label"
          className="mt-1.5 border-white/15 bg-black/30 text-white"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={isExperience ? t("slotLabelPlaceholderExperience") : t("slotLabelPlaceholder")}
        />
      </div>
      {isExperience ? (
        <div>
          <Label htmlFor="slot-capacity" className="text-cyan-100">
            {t("slotCapacityLabel")}
          </Label>
          <Input
            id="slot-capacity"
            type="number"
            min={1}
            max={500}
            className="mt-1.5 border-white/15 bg-black/30 text-white"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      ) : null}
      <Button
        type="button"
        disabled={busy}
        onClick={() => void addSlot()}
        className="w-full bg-cyan-600 hover:bg-cyan-500"
      >
        <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
        {t("addSlot")}
      </Button>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-cyan-200/80">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("loadingSlots")}
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm text-amber-200/90">{t("noSlotsYet")}</p>
      ) : (
        <ul className="max-h-52 space-y-2 overflow-y-auto">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {slot.label ?? new Date(slot.startsAt).toLocaleString()}
                </p>
                <p className="text-xs text-cyan-200/70">
                  {t("slotMeta", { booked: slot.bookedCount, capacity: slot.capacity, status: slot.status })}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || slot.bookedCount > 0}
                onClick={() => void removeSlot(slot.id)}
                className="shrink-0 rounded-lg p-2 text-red-300 transition hover:bg-red-950/40 disabled:opacity-40"
                aria-label={t("deleteSlot")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
