"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { PlanStatus } from "@/lib/reseller-copilot/observation-plan"

type View = { plannedAt: string; initialHorizonDays: number | null; status: PlanStatus }

/**
 * Where the observation plan of a listing stands — one compact block (in the withdrawal confirmation). Fetched with a
 * timeout, renders nothing until an answer and nothing without a plan; never delays or blocks any button.
 */
export function ObservationPlanStatus({ listingId }: { listingId: string }) {
  const t = useTranslations("affiliate.observationPlan")
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 2_500)
    fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}/observation-plan`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { view?: View | null } | null) => setView(j?.view ?? null))
      .catch(() => setView(null))
      .finally(() => window.clearTimeout(timer))
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [listingId])

  if (!view || view.status.phase === "retire") return null
  const s = view.status
  return (
    <aside aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-[13px] leading-relaxed text-zinc-300">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{t("statusTitle")}</p>
      <p className="mt-1.5 text-white">{t(`phase.${s.phase}`, { elapsed: s.elapsedDays, horizon: s.horizonDays ?? 0, sales: s.sales })}</p>
      {s.horizonUpdated && s.horizonDays != null && view.initialHorizonDays != null ? (
        <p>{t("horizonUpdated", { horizon: s.horizonDays, initial: view.initialHorizonDays })}</p>
      ) : null}
      {s.recommendation ? <p className="mt-1 text-white">{t(`recommendation.${s.recommendation}`)}</p> : null}
      <p className="mt-1.5 text-[11px] text-zinc-400">
        {t("notMeasured")} · {t("free")}
      </p>
    </aside>
  )
}
