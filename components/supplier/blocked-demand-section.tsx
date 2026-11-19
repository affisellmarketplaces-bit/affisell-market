"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import type { BlockedDemandAlert } from "@/lib/supplier-demand-alerts/blocked-demand"

type Data = { items: BlockedDemandAlert[]; truncated: boolean }

/**
 * Supplier: its products whose REAL demand is blocked by an unavailability it can fix. Facts and the estimate are
 * shown apart; the fix opens the product sheet (the normal catalogue path) — nothing is changed from here.
 */
export function BlockedDemandSection() {
  const t = useTranslations("catalogHealth.blockedDemand")
  const locale = useLocale()
  const [data, setData] = useState<Data | null>(null)
  const [pref, setPref] = useState<boolean | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([
      fetch("/api/supplier/blocked-demand", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/supplier/alert-preferences", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
    setData(d)
    setPref(p && typeof p.blockedDemandInApp === "boolean" ? p.blockedDemandInApp : null)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePref(next: boolean) {
    setPref(next)
    setSaved(false)
    const r = await fetch("/api/supplier/alert-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blockedDemandInApp: next, locale }),
    }).catch(() => null)
    if (r?.ok) setSaved(true)
  }

  if (!data) return null
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale)

  return (
    <section id="blocked-demand" className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>
      {data.truncated ? <p className="text-xs text-amber-700">{t("truncated")}</p> : null}
      {data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((a) => (
            <li key={a.productId} className="space-y-1 rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-sm">
              <p className="font-medium">{a.productName}</p>
              <p className="text-zinc-700">{t(`cause.${a.cause}`)}</p>
              <p className="text-xs text-zinc-600">
                {a.since ? t("since", { date: fmt(a.since), days: a.daysUnavailable ?? 0 }) : t("sinceUnknown")}
              </p>
              <ul className="list-disc pl-5 text-xs text-zinc-700">
                {a.observed.ordersBefore > 0 ? <li>{t("ordersBefore", { count: a.observed.ordersBefore })}</li> : null}
                {a.observed.ordersSince > 0 ? <li>{t("ordersSince", { count: a.observed.ordersSince })}</li> : null}
                {a.observed.failedPaidLines > 0 ? <li>{t("failedLines", { count: a.observed.failedPaidLines })}</li> : null}
                <li>{t("shops", { count: a.observed.liveListings })}</li>
                {a.observed.lastPaidAt ? <li>{t("lastSale", { date: fmt(a.observed.lastPaidAt) })}</li> : null}
              </ul>
              {a.estimate ? (
                <p className="text-xs italic text-zinc-500">
                  {t("estimate", { orders: a.estimate.orders, low: a.estimate.low, high: a.estimate.high })}
                </p>
              ) : null}
              <Link
                href={`/dashboard/supplier/products/${encodeURIComponent(a.productId)}/edit`}
                className="inline-block text-sm font-medium text-violet-700 underline"
              >
                {t(`fix.${a.fix}`)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">{t("note")}</p>
      {pref !== null ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pref} onChange={(e) => void togglePref(e.target.checked)} />
          {t("pref")}
          {saved ? <span className="text-xs text-emerald-700">{t("prefSaved")}</span> : null}
        </label>
      ) : null}
    </section>
  )
}
