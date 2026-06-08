"use client"

import { CalendarCheck, MessageSquare, Ticket, Users } from "lucide-react"
import { useEffect, useState } from "react"

import type { BookingFounderStats } from "@/lib/booking/founder-stats"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function AdminBookingStatsStrip({ className }: Props) {
  const [stats, setStats] = useState<BookingFounderStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    void fetch("/api/admin/booking-stats", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setError(true)
          return
        }
        const data = (await res.json()) as { stats?: BookingFounderStats }
        if (data.stats) setStats(data.stats)
      })
      .catch(() => setError(true))
  }, [])

  if (error || !stats) return null

  const cards = [
    {
      label: "Confirmées 7j",
      value: String(stats.confirmed7d),
      hint: `${stats.confirmed30d} sur 30j`,
      icon: Ticket,
    },
    {
      label: "Check-in 7j",
      value: stats.checkInRate7dPct != null ? `${stats.checkInRate7dPct}%` : "—",
      hint: `${stats.noShowGuests7d} no-show`,
      icon: Users,
    },
    {
      label: "Attente aujourd'hui",
      value: String(stats.pendingCheckInsToday),
      hint: "créneaux du jour",
      icon: CalendarCheck,
    },
    {
      label: "Rappels H-2",
      value: `${stats.hourEmailReminders7d} mail`,
      hint: `${stats.hourSmsReminders7d} SMS · ${stats.experienceShare30dPct}% cinéma`,
      icon: MessageSquare,
    },
  ]

  return (
    <section
      className={cn(
        "rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/80 via-slate-950 to-violet-950/60 p-4",
        className
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Booking · Founder</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
          >
            <div className="flex items-center gap-2 text-cyan-200/80">
              <card.icon className="h-3.5 w-3.5" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-white">{card.value}</p>
            <p className="text-[11px] text-cyan-100/65">{card.hint}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
