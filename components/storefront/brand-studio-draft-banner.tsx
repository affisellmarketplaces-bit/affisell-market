"use client"

import { History } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"

type Props = {
  savedAt: number
  onRestore: () => void
  onDiscard: () => void
}

/** "Last edited 12 minutes ago" in the viewer's language, via Intl (no hand-written plural rules). */
function relativeWhen(savedAt: number, locale: string, justNow: string): string {
  const seconds = Math.round((savedAt - Date.now()) / 1000)
  if (Math.abs(seconds) < 45) return justNow
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour")
  return rtf.format(Math.round(hours / 24), "day")
}

export function BrandStudioDraftBanner({ savedAt, onRestore, onDiscard }: Props) {
  const t = useTranslations("storefront.brandStudio.draft")
  const locale = useLocale()
  const when = useMemo(() => relativeWhen(savedAt, locale, t("relativeNow")), [savedAt, locale, t])

  return (
    <BentoCard
      role="status"
      className="border-violet-200/80 bg-violet-50/70 py-3 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/25 dark:text-violet-100"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3">
          <History className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
          <span>
            <span className="font-semibold">{t("title")}</span>
            <span className="mt-0.5 block text-violet-900/80 dark:text-violet-100/80">{t("body", { when })}</span>
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="bentoSolid" size="bento" onClick={onRestore}>
            {t("restore")}
          </Button>
          <Button type="button" variant="outline" size="bento" onClick={onDiscard}>
            {t("discard")}
          </Button>
        </div>
      </div>
    </BentoCard>
  )
}
