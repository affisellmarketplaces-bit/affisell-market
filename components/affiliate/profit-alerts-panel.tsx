"use client"

import Link from "next/link"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

export type ProfitAlertView = {
  id: string
  listingId: string | null
  createdAt: string
  title: string
  change: string
  since: string
  causes: string[]
  suggestion: string
}

type Pref = { inApp: boolean; email: boolean; locale: string }

/**
 * The reseller's own profitability alerts (already formatted on the server) + their channel preferences. Dismissing an
 * alert only hides it; saving preferences writes the reseller's choice and the language alerts are written in.
 */
export function ProfitAlertsPanel({ alerts, preference }: { alerts: ProfitAlertView[]; preference: Pref }) {
  const t = useTranslations("affiliate.profitAlerts")
  const locale = useLocale()
  const [items, setItems] = useState(alerts)
  const [pref, setPref] = useState<Pref>(preference)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function save(next: Pref) {
    setPref(next)
    setStatus("saving")
    try {
      const res = await fetch("/api/affiliate/alert-preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      })
      setStatus(res.ok ? "saved" : "error")
    } catch {
      setStatus("error")
    }
  }

  async function dismiss(id: string) {
    const res = await fetch(`/api/affiliate/profit-alerts/${encodeURIComponent(id)}/dismiss`, { method: "POST" }).catch(() => null)
    if (res?.ok) setItems((list) => list.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("panelTitle")}</h3>
      </div>
      <p className="text-[11px] text-zinc-500">{t("panelIntro")}</p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("panelEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{a.title}</div>
                <button type="button" onClick={() => dismiss(a.id)} className="text-[11px] text-zinc-500 hover:underline">
                  {t("dismiss")}
                </button>
              </div>
              <div className="text-xs text-zinc-700 dark:text-zinc-300">{a.change}</div>
              <div className="text-[11px] text-zinc-500">{a.since}</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-zinc-700 dark:text-zinc-300">
                {a.causes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-1 text-xs text-zinc-800 dark:text-zinc-200">{a.suggestion}</div>
              {a.listingId ? (
                <Link
                  href={`/dashboard/affiliate/products/${encodeURIComponent(a.listingId)}/edit`}
                  className="mt-1 inline-block text-[11px] font-medium text-violet-700 hover:underline"
                >
                  {t("ctaEdit")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <fieldset className="flex flex-wrap items-center gap-4 text-xs text-zinc-700 dark:text-zinc-300">
        <legend className="mb-1 text-[11px] text-zinc-500">{t("prefTitle")}</legend>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={pref.inApp} onChange={(e) => save({ ...pref, inApp: e.target.checked, locale })} />
          {t("prefInApp")}
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={pref.email} onChange={(e) => save({ ...pref, email: e.target.checked, locale })} />
          {t("prefEmail")}
        </label>
        {status !== "idle" ? <span className="text-[11px] text-zinc-500">{t(`prefStatus.${status}`)}</span> : null}
      </fieldset>
      <p className="text-[11px] text-zinc-500">{t("disclaimer")}</p>
    </div>
  )
}
