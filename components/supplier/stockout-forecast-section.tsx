"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import type { StockoutForecast } from "@/lib/supplier-catalog-health/stockout-forecast"

type Item = { productId: string; productName: string; liveListings: number; forecast: StockoutForecast }

/**
 * Supplier: products shown in resellers' shops whose stock may run out before a restock arrives. Facts, calculation,
 * hypotheses and limits are shown apart; the only action here is « this quantity is right » (dated, never changes the
 * quantity) — a different figure goes through the product sheet.
 */
export function StockoutForecastSection() {
  const t = useTranslations("catalogHealth.stockout")
  const locale = useLocale()
  const [items, setItems] = useState<Item[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [status, setStatus] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const r = await fetch("/api/supplier/stockout-forecast", { cache: "no-store" }).catch(() => null)
    const d = r?.ok ? await r.json().catch(() => null) : null
    setItems(Array.isArray(d?.items) ? d.items : [])
    setTruncated(Boolean(d?.truncated))
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function confirm(it: Item) {
    const units = it.forecast.facts.declaredUnits
    if (units === null) return
    const r = await fetch(`/api/supplier/products/${encodeURIComponent(it.productId)}/stock-confirmation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ units }),
    }).catch(() => null)
    const body = r ? await r.json().catch(() => ({})) : {}
    setStatus((s) => ({ ...s, [it.productId]: r?.ok ? "ok" : String(body?.error ?? "error") }))
    if (r?.ok) void load()
  }

  if (!items) return null
  const shown = items.filter((i) => i.forecast.risk !== "suffisant")
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale)

  return (
    <section id="stockout-forecast" className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>
      {truncated ? <p className="text-xs text-amber-700">{t("truncated")}</p> : null}
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((it) => {
            const f = it.forecast
            const c = f.calculation
            return (
              <li key={it.productId} className="space-y-2 rounded-xl border border-zinc-200 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{it.productName}</p>
                  <span className="text-xs font-semibold">
                    {t(`risk.${f.risk}`)} · {t(`confidence.${f.confidence}`)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500">{t("factsTitle")}</p>
                    <ul className="list-disc pl-5 text-xs text-zinc-700">
                      <li>{f.facts.declaredUnits === null ? t("declaredUnknown") : t("declared", { units: f.facts.declaredUnits })}</li>
                      <li>{t(f.facts.reservedAlreadyDeducted ? "reservedDeducted" : "reservedNotDeducted", { units: f.facts.reservedUnits })}</li>
                      <li>{t("sold", { units: f.facts.unitsSold, days: f.facts.saleDays })}</li>
                      <li>{f.facts.confirmedAt ? t("confirmedOn", { date: fmt(f.facts.confirmedAt) }) : t("neverConfirmed")}</li>
                      {f.facts.sheetAgeDays !== null ? <li>{t("sheetAge", { days: f.facts.sheetAgeDays })}</li> : null}
                      <li>{f.facts.leadTimeDays !== null ? t("leadKnown", { days: f.facts.leadTimeDays }) : t("leadUnknown")}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-500">{t("calcTitle")}</p>
                    {c.coverDays !== null ? (
                      <ul className="list-disc pl-5 text-xs text-zinc-700">
                        <li>{t("available", { units: c.availableUnits ?? 0 })}</li>
                        <li>{t("pace", { pace: c.dailyPace ?? 0, low: c.dailyPaceLow ?? 0, high: c.dailyPaceHigh ?? 0 })}</li>
                        <li>
                          {c.coverDaysHigh !== null
                            ? t("cover", { days: c.coverDays, low: c.coverDaysLow ?? 0, high: c.coverDaysHigh })
                            : t("coverOpen", { days: c.coverDays, low: c.coverDaysLow ?? 0 })}
                        </li>
                        <li>{t(c.comparedWith === "declared_lead_time" ? "comparedLead" : "comparedIndicative", { days: c.comparedWithDays })}</li>
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-500">{t("notCalculated")}</p>
                    )}
                  </div>
                </div>
                {f.hypotheses.length ? (
                  <p className="text-xs italic text-zinc-500">
                    {t("hypothesesTitle")} {f.hypotheses.map((h) => t(`hypothesis.${h}`)).join(" · ")}
                  </p>
                ) : null}
                {f.limits.length ? (
                  <p className="text-xs text-amber-700">
                    {t("limitsTitle")} {f.limits.map((l) => t(`limit.${l}`)).join(" · ")}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {f.action !== "none" ? <span className="text-xs font-medium text-zinc-800">{t(`action.${f.action}`)}</span> : null}
                  <Link href={`/dashboard/supplier/products/${encodeURIComponent(it.productId)}/edit`} className="text-xs font-medium text-violet-700 underline">
                    {t("openSheet")}
                  </Link>
                  {f.facts.declaredUnits !== null && !f.limits.includes("unconfirmed_marker") ? (
                    <button type="button" onClick={() => void confirm(it)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs">
                      {t("confirmButton", { units: f.facts.declaredUnits })}
                    </button>
                  ) : null}
                  {status[it.productId] ? (
                    <span className="text-xs text-zinc-600">{t(`confirmResult.${status[it.productId] in CONFIRM_RESULTS ? status[it.productId] : "error"}`)}</span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-zinc-500">{t("note")}</p>
    </section>
  )
}

const CONFIRM_RESULTS: Record<string, true> = { ok: true, quantity_changed: true, unconfirmed_import: true, quantity_unknown: true, error: true }
