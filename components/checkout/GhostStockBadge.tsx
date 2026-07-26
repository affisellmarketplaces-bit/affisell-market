"use client"

import { useMemo } from "react"
import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  lastStockCheck?: string | Date | null
  lastStockStatus?: string | null
  className?: string
}

function minutesAgo(d: Date): number {
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000))
}

/**
 * Ghost Checkout badge — stock vérifié chez le fournisseur.
 */
export function GhostStockBadge({ lastStockCheck, lastStockStatus, className }: Props) {
  const info = useMemo(() => {
    if (!lastStockCheck) return null
    const checked =
      typeof lastStockCheck === "string" ? new Date(lastStockCheck) : lastStockCheck
    if (Number.isNaN(checked.getTime())) return null
    const mins = minutesAgo(checked)
    if (mins > 24 * 60) return null
    if (lastStockStatus === "out_of_stock") return null

    if (mins < 60) {
      return {
        tone: "fresh" as const,
        label: `Stock vérifié il y a ${Math.max(1, mins)} min`,
      }
    }
    return { tone: "today" as const, label: "Stock vérifié aujourd’hui" }
  }, [lastStockCheck, lastStockStatus])

  if (!info) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        info.tone === "fresh"
          ? "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-200"
          : "bg-zinc-500/10 text-zinc-600 ring-1 ring-zinc-400/20 dark:text-zinc-300",
        className
      )}
      title="On vérifie le stock chez le fournisseur avant chaque paiement"
      data-testid="ghost-stock-badge"
    >
      <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
      {info.tone === "fresh" ? `✓ ${info.label}` : info.label}
    </span>
  )
}
