"use client"

import { CalendarClock } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { ObservationPlan, PlanSilence } from "@/lib/reseller-copilot/observation-plan"

/**
 * Observation plan inside « Pourquoi ce produit ? » — fetched only once the reseller opens the panel; shows nothing
 * until the server answers, and nothing at all while the feature is off. Never part of the add: adding stays one click.
 */
export function ObservationPlanPreview({ productId }: { productId: string }) {
  const t = useTranslations("affiliate.observationPlan")
  const locale = useLocale()
  const [data, setData] = useState<{ plan: ObservationPlan | null; silence: PlanSilence | null } | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/affiliate/copilot/observation-plan?productId=${encodeURIComponent(productId)}`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j ?? null))
      .catch(() => setData(null))
    return () => ctrl.abort()
  }, [productId])

  if (!data || (!data.plan && !data.silence)) return null
  if (!data.plan) {
    return <p className="mt-1.5 text-[11px] text-zinc-500">{t(`silence.${data.silence}`)}</p>
  }
  const p = data.plan
  const date = new Date(p.firstReviewAt).toLocaleDateString(locale, { day: "numeric", month: "short" })
  return (
    <div className="mt-1.5 rounded-lg bg-violet-50/70 p-2 text-xs text-zinc-700 ring-1 ring-violet-100 dark:bg-violet-950/30 dark:text-zinc-300 dark:ring-violet-900/40">
      <p className="flex items-center gap-1 font-medium text-violet-900 dark:text-violet-200">
        <CalendarClock className="size-3.5" aria-hidden />
        {t("title")}
      </p>
      <p className="mt-1">{t("horizon", { days: p.horizonDays, date })}</p>
      <p className="text-zinc-600 dark:text-zinc-400">{t("distribution", { resellers: p.resellers, p50: p.quartiles.p50, p75: p.quartiles.p75 })}</p>
      {p.saleSharePct != null ? <p className="text-zinc-600 dark:text-zinc-400">{t("saleShare", { pct: p.saleSharePct, days: p.horizonDays })}</p> : null}
      <p className="mt-1 text-[11px] text-zinc-500">
        {t(`tier.${p.tier}`)} · {t(p.confidence === "moyenne" ? "confidenceMedium" : "confidenceLow")} ({t(`reason.${p.confidenceReason}`)}) · {t("noGuarantee")} {t("limits")}
      </p>
    </div>
  )
}
