"use client"

import { BarChart3, UserCheck, UserMinus, Users } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

export type SupplierBookingStatsView = {
  totalGuests: number
  checkedInGuests: number
  pendingGuests: number
  noShowGuests: number
  checkInRatePct: number | null
}

type Props = {
  stats: SupplierBookingStatsView
  className?: string
}

export function SupplierBookingStatsBar({ stats, className }: Props) {
  const t = useTranslations("supplier.booking.roster")

  const items = [
    {
      key: "total",
      label: t("statsTotalGuests"),
      value: String(stats.totalGuests),
      icon: Users,
      tone: "text-zinc-700 dark:text-zinc-200",
    },
    {
      key: "checkedIn",
      label: t("statsCheckedIn"),
      value: String(stats.checkedInGuests),
      icon: UserCheck,
      tone: "text-emerald-700 dark:text-emerald-300",
    },
    {
      key: "pending",
      label: t("statsPending"),
      value: String(stats.pendingGuests),
      icon: Users,
      tone: "text-amber-700 dark:text-amber-300",
    },
    {
      key: "noShow",
      label: t("statsNoShow"),
      value: String(stats.noShowGuests),
      icon: UserMinus,
      tone: "text-red-700 dark:text-red-300",
    },
    {
      key: "rate",
      label: t("statsCheckInRate"),
      value: stats.checkInRatePct != null ? `${stats.checkInRatePct}%` : "—",
      icon: BarChart3,
      tone: "text-cyan-700 dark:text-cyan-300",
    },
  ]

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <item.icon className="h-3.5 w-3.5" aria-hidden />
            {item.label}
          </p>
          <p className={cn("mt-1 text-xl font-semibold tabular-nums", item.tone)}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}
