"use client"

import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { assessTitle, type TitleIssue } from "@/lib/listing-quality"

type Props = {
  title: string
  onApply: (cleaned: string) => void
}

/**
 * Instant, offline advice on the title (no AI call): what makes a supplier feed look like a copy-pasted
 * marketplace listing to a buyer — and a one-tap cleaned version. Advisory only, never blocks publishing.
 */
export function SupplierTitleQualityHint({ title, onApply }: Props) {
  const t = useTranslations("supplierQuality")
  const trimmed = title.trim()
  if (trimmed.length === 0) return null
  const { issues, suggestion, ok } = assessTitle(trimmed)
  if (ok) return null

  const canApply = suggestion.trim().length >= 3 && suggestion.trim() !== trimmed
  return (
    <div
      role="status"
      className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"
    >
      <p className="font-semibold">{t("titleHeading")}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {issues.map((i: TitleIssue) => (
          <li key={i}>{t(`title.${i}`)}</li>
        ))}
      </ul>
      {canApply ? (
        <button
          type="button"
          onClick={() => onApply(suggestion)}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-500"
        >
          <Sparkles className="size-3.5" aria-hidden />
          {t("apply")}
          <span className="ml-1 max-w-[16rem] truncate font-normal opacity-90">“{suggestion}”</span>
        </button>
      ) : null}
    </div>
  )
}
