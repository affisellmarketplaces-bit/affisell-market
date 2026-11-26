"use client"

import { Hourglass } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { RetentionAdvice } from "@/lib/reseller-copilot/retention-advisor"

/**
 * Smart Retention Advisor — the discreet note inside the withdrawal confirmation. Fetched when the dialog opens; shows
 * nothing until (and unless) the server has something reliable to say; never delays or blocks the confirm button.
 */
const FETCH_TIMEOUT_MS = 2_500

export function RetentionAdviceNote({ listingId }: { listingId: string }) {
  const t = useTranslations("affiliate.retentionAdvice")
  const [advice, setAdvice] = useState<RetentionAdvice | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}/retention-advice`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { advice?: RetentionAdvice | null } | null) => setAdvice(j?.advice ?? null))
      .catch(() => setAdvice(null))
      .finally(() => window.clearTimeout(timer))
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [listingId])

  if (!advice) return null
  const q = advice.quartiles
  return (
    <aside
      aria-live="polite"
      className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-left text-[13px] leading-relaxed text-zinc-200"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
        <Hourglass className="size-3.5" aria-hidden />
        {t("eyebrow")}
      </p>
      <p className="mt-1.5 font-semibold text-white">{t("title")}</p>
      <ul className="mt-2 space-y-1 text-zinc-300">
        <li>{t("current", { days: advice.currentDays })}</li>
        <li>
          {t(advice.tier === "product" ? "typicalProduct" : "typicalCategory", { resellers: advice.resellers, p25: q.p25, p50: q.p50, p75: q.p75 })}{" "}
          {t("late", { pct: advice.lateSharePct, days: advice.currentDays })}
        </li>
        {advice.conditional ? (
          <li>{t("conditional", { pct: advice.conditional.pct, days: advice.currentDays, recommended: advice.recommendedDays })}</li>
        ) : null}
        <li className="text-white">
          {t("suggestion", { extra: advice.extraDays, recommended: advice.recommendedDays })} {t("noGuarantee")}
        </li>
      </ul>
      <p className="mt-2 text-[11px] text-zinc-400">
        {t(advice.confidence === "moyenne" ? "confidenceMedium" : "confidenceLow")} · {t(`reason_${advice.confidenceReason}`)} · {t("yourCall")}
      </p>
    </aside>
  )
}
