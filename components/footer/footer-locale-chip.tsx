"use client"

import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  className?: string
}

/** Sélecteur langue glass — pied de page public. */
export function FooterLocaleChip({ label, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/60">{label}</span>
      <LanguageSwitcher className="[&>button]:border-white/20 [&>button]:bg-white/10 [&>button]:text-violet-100 [&>button]:backdrop-blur-md [&>button]:hover:border-white/35 [&>button]:hover:bg-white/15 [&>button]:hover:text-white" />
    </div>
  )
}
