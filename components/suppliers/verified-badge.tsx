"use client"

import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

type VerifiedBadgeProps = {
  className?: string
  label?: string
  tooltip?: string
}

export function VerifiedBadge({
  className,
  label = "Affisell+",
  tooltip = "Fournisseur vérifié : livraison 48h, SAV premium, note 4.6+",
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-sky-400/60 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:border-sky-500/70 dark:bg-sky-500/20 dark:text-sky-200",
        className
      )}
      title={tooltip}
      aria-label={tooltip}
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
