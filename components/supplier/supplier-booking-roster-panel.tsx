"use client"

import { CalendarClock, CheckCircle2, Loader2, MapPin, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { SupplierBookingCheckInForm } from "@/components/supplier/supplier-booking-check-in-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type RosterRow = {
  orderId: string
  customerEmail: string
  quantity: number
  productName: string
  slotId: string | null
  slotStartsAt: string | null
  slotEndsAt: string | null
  slotLabel: string | null
  venueLabel: string | null
  seatLabels: string[]
  bookingCheckedInAt: string | null
  checkedIn: boolean
}

type SlotFilter = {
  id: string
  productName: string
  startsAt: string
  label: string | null
  pendingCheckInCount: number
}

type Tab = "pending" | "checked_in" | "all"

function formatSlotTime(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "—"
  const start = new Date(startsAt)
  if (!Number.isFinite(start.getTime())) return startsAt
  const end = endsAt ? new Date(endsAt) : null
  const datePart = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const timePart = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  const endPart =
    end && Number.isFinite(end.getTime())
      ? end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : null
  return endPart ? `${datePart} · ${timePart}–${endPart}` : `${datePart} · ${timePart}`
}

export function SupplierBookingRosterPanel({ className }: { className?: string }) {
  const t = useTranslations("supplier.booking.roster")
  const [tab, setTab] = useState<Tab>("pending")
  const [slotId, setSlotId] = useState<string>("")
  const [rows, setRows] = useState<RosterRow[] | null>(null)
  const [slots, setSlots] = useState<SlotFilter[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const params = new URLSearchParams({ checkedIn: tab })
    if (slotId) params.set("slotId", slotId)
    const res = await fetch(`/api/supplier/booking/roster?${params.toString()}`, { cache: "no-store" })
    if (!res.ok) {
      setError(t("loadError"))
      setRows([])
      return
    }
    const json = (await res.json()) as {
      rows: RosterRow[]
      slots: SlotFilter[]
      pendingCheckInCount: number
    }
    setRows(json.rows)
    setSlots(json.slots)
    setPendingCount(json.pendingCheckInCount)
  }, [slotId, t, tab])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const list = rows ?? []
    const map = new Map<string, RosterRow[]>()
    for (const row of list) {
      const key = row.slotId ?? row.slotStartsAt ?? "unknown"
      const bucket = map.get(key) ?? []
      bucket.push(row)
      map.set(key, bucket)
    }
    return [...map.entries()].sort((a, b) => {
      const ta = a[1][0]?.slotStartsAt ?? ""
      const tb = b[1][0]?.slotStartsAt ?? ""
      return ta.localeCompare(tb)
    })
  }, [rows])

  async function checkInFromRow(orderId: string) {
    setBusyOrderId(orderId)
    try {
      const res = await fetch("/api/supplier/booking/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(t(`errors.${json.error ?? "checkInFailed"}` as "errors.not_found"))
        return
      }
      toast.success(t("checkInSuccess"))
      await load()
    } catch {
      toast.error(t("checkInFailed"))
    } finally {
      setBusyOrderId(null)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "pending", label: t("tabPending") },
    { id: "checked_in", label: t("tabCheckedIn") },
    { id: "all", label: t("tabAll") },
  ]

  return (
    <div className={cn("space-y-6", className)}>
      <SupplierBookingCheckInForm onCheckedIn={() => void load()} />

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "pending" && pendingCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </Button>
        ))}

        <select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          className="ml-auto min-w-[12rem] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-label={t("slotFilterLabel")}
        >
          <option value="">{t("allSlots")}</option>
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {formatSlotTime(slot.startsAt, null)}
              {slot.label ? ` · ${slot.label}` : ""} ({slot.productName})
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {rows === null ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-500">{t("empty")}</Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, groupRows]) => {
            const head = groupRows[0]
            if (!head) return null
            return (
              <Card key={key} className="overflow-hidden">
                <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <CalendarClock className="h-4 w-4 text-cyan-600" aria-hidden />
                    {formatSlotTime(head.slotStartsAt, head.slotEndsAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {head.productName}
                    {head.slotLabel ? ` · ${head.slotLabel}` : ""}
                  </p>
                  {head.venueLabel ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {head.venueLabel}
                    </p>
                  ) : null}
                </div>

                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {groupRows.map((row) => (
                    <li
                      key={row.orderId}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {row.customerEmail}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" aria-hidden />×{row.quantity}
                          </span>
                          {row.seatLabels.length > 0 ? (
                            <span className="font-mono text-cyan-700 dark:text-cyan-300">
                              {row.seatLabels.join(" · ")}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {row.checkedIn ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          {row.bookingCheckedInAt
                            ? new Date(row.bookingCheckedInAt).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : t("checkedInBadge")}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyOrderId === row.orderId}
                          onClick={() => void checkInFromRow(row.orderId)}
                        >
                          {busyOrderId === row.orderId ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            t("checkInRow")
                          )}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
