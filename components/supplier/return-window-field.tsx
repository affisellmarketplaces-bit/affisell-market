"use client"

import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Label } from "@/components/ui/label"
import { LEGAL_RETURN_WINDOW_DAYS, parseReturnWindowDays, RETURN_WINDOW_PRESETS } from "@/lib/return-terms"
import { cn } from "@/lib/utils"

type Props = {
  /** "" = nothing offered beyond the legal window; otherwise the offered number of days, as text. */
  value: string
  onChange: (next: string) => void
  id?: string
  className?: string
}

/**
 * The supplier decides how long a buyer can return THIS product, and carries the cost (same as a return inside the legal
 * 14 days). Only extensions exist: the legal window is the floor and is the empty value.
 */
export function ReturnWindowField({ value, onChange, id = "return-window", className }: Props) {
  const t = useTranslations("supplier.returnTerms")
  const current = parseReturnWindowDays(value)
  // A value set through the API that is not one of the presets must stay selectable, or the select would silently change it.
  const options = [...new Set([...RETURN_WINDOW_PRESETS, ...(current ? [current] : [])])].sort((a, b) => a - b)

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label htmlFor={id}>{t("label")}</Label>
        <select
          id={id}
          className="mt-1.5 flex h-11 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-700"
          value={current ? String(current) : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("optionLegal")}</option>
          {options.map((days) => (
            <option key={days} value={String(days)}>
              {t("optionDays", { days })}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("hint")}</p>
      </div>
      {current && current > LEGAL_RETURN_WINDOW_DAYS ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">{t("cost")}</p>
        </div>
      ) : null}
    </div>
  )
}
