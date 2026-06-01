"use client"

import { useEffect, useState } from "react"
import { Timer } from "lucide-react"
import { useTranslations } from "next-intl"

import { formatShipPulseCountdown } from "@/lib/supplier-ship-sla-shared"
import { cn } from "@/lib/utils"

export type ShipPulsePhase = "safe" | "urgent" | "critical" | "breached"

type Props = {
  deadlineAt: string
  msRemaining: number
  phase: ShipPulsePhase
  extensionPending?: boolean
  className?: string
}

const phaseStyles: Record<ShipPulsePhase, string> = {
  safe: "border-cyan-200/90 bg-gradient-to-r from-cyan-50/90 via-white to-violet-50/80 text-cyan-950 dark:border-cyan-900/50 dark:from-cyan-950/40 dark:via-zinc-950 dark:to-violet-950/30 dark:text-cyan-100",
  urgent:
    "border-amber-300/90 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/70 text-amber-950 shadow-sm shadow-amber-200/40 dark:border-amber-800/60 dark:from-amber-950/50 dark:text-amber-100 dark:shadow-amber-950/30",
  critical:
    "border-red-400/90 bg-gradient-to-r from-red-50 via-rose-50/90 to-orange-50 text-red-950 shadow-md shadow-red-300/30 animate-pulse dark:border-red-800 dark:from-red-950/60 dark:text-red-100",
  breached:
    "border-red-600 bg-red-600 text-white shadow-lg shadow-red-500/40 ring-2 ring-red-400/50 animate-pulse dark:border-red-500 dark:bg-red-700 dark:shadow-red-950/50",
}

export function ShipPulseBadge({
  deadlineAt,
  msRemaining: initialMs,
  phase: initialPhase,
  extensionPending,
  className,
}: Props) {
  const t = useTranslations("supplierOrders.shipPulse")
  const [msRemaining, setMsRemaining] = useState(initialMs)
  const [phase, setPhase] = useState(initialPhase)

  useEffect(() => {
    setMsRemaining(initialMs)
    setPhase(initialPhase)
  }, [initialMs, initialPhase, deadlineAt])

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = new Date(deadlineAt).getTime() - Date.now()
      setMsRemaining(left)
      if (left <= 0) setPhase("breached")
      else if (left < 6 * 3_600_000) setPhase("critical")
      else if (left < 24 * 3_600_000) setPhase("urgent")
      else setPhase("safe")
    }, 30_000)
    return () => window.clearInterval(id)
  }, [deadlineAt])

  const countdown = msRemaining > 0 ? formatShipPulseCountdown(msRemaining) : "0d 00h"
  const labelKey = extensionPending
    ? "pendingExtension"
    : phase === "breached"
      ? "breached"
      : phase === "critical"
        ? "critical"
        : phase === "urgent"
          ? "urgent"
          : "safe"

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium tabular-nums",
        phaseStyles[phase],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Timer className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="font-semibold tracking-wide uppercase">{t("label")}</span>
      <span className="font-mono text-sm">{countdown}</span>
      <span className="opacity-90">· {t(labelKey)}</span>
    </div>
  )
}
