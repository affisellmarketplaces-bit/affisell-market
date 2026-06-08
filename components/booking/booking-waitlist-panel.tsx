"use client"

import { useState } from "react"
import { Bell, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import type { PublicBookingSlotRow } from "@/lib/booking/slot-availability"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  soldOutSlots: PublicBookingSlotRow[]
  className?: string
}

export function BookingWaitlistPanel({ productId, soldOutSlots, className }: Props) {
  const t = useTranslations("Product.booking")
  const [email, setEmail] = useState("")
  const [busySlotId, setBusySlotId] = useState<string | null>(null)
  const [joined, setJoined] = useState<Set<string>>(new Set())

  if (soldOutSlots.length === 0) return null

  async function join(slotId: string) {
    setBusySlotId(slotId)
    try {
      const res = await fetch("/api/booking/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slotId,
          productId,
          email: email.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        if (json.error === "slot_available") toast.error(t("waitlistSlotAvailable"))
        else if (json.error === "email_required") toast.error(t("waitlistEmailRequired"))
        else toast.error(t("waitlistJoinFailed"))
        return
      }
      setJoined((prev) => new Set(prev).add(slotId))
      toast.success(t("waitlistJoinSuccess"))
    } finally {
      setBusySlotId(null)
    }
  }

  return (
    <section
      className={cn(
        "mt-4 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4",
        className
      )}
    >
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
        <Bell className="h-3.5 w-3.5" aria-hidden />
        {t("waitlistTitle")}
      </p>
      <p className="mt-1 text-xs text-amber-100/80">{t("waitlistHint")}</p>
      <div className="mt-3">
        <Input
          type="email"
          placeholder={t("waitlistEmailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-white/15 bg-black/30 text-white"
        />
      </div>
      <ul className="mt-3 space-y-2">
        {soldOutSlots.map((slot) => {
          const starts = new Date(slot.startsAt)
          const label = slot.label ?? starts.toLocaleString()
          const isJoined = joined.has(slot.id)
          return (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <span className="text-amber-100/90">{label}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busySlotId === slot.id || isJoined}
                className="border-amber-400/40 text-amber-100 hover:bg-amber-500/10"
                onClick={() => void join(slot.id)}
              >
                {busySlotId === slot.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : isJoined ? (
                  t("waitlistJoined")
                ) : (
                  t("waitlistCta")
                )}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
