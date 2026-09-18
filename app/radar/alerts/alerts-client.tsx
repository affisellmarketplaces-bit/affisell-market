"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import type { AlertType, Severity } from "@/lib/radar/alerts/types"

type AlertRow = {
  id: string
  type: string
  severity: string
  title: string
  message: string
  productId: string | null
  marketplaceId: string
  country: string | null
  meta: unknown
  read: boolean
  createdAt: string | Date
}

const TYPE_ICON: Record<string, string> = {
  WINNER_NEW: "🔥",
  WINNER_RISING: "📈",
  PRICE_WAR: "⚠️",
  SATURATION_RISK: "🟡",
  NEW_LISTING: "✨",
  TRENDING_KEYWORD: "📊",
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-900 border-amber-200",
  low: "bg-zinc-100 text-zinc-700 border-zinc-200",
}

type TFn = (key: string, values?: Record<string, string | number>) => string

const TYPE_KEY: Record<string, string> = {
  WINNER_NEW: "typeWinnerNew",
  WINNER_RISING: "typeWinnerRising",
  PRICE_WAR: "typePriceWar",
  SATURATION_RISK: "typeSaturationRisk",
  NEW_LISTING: "typeNewListing",
  TRENDING_KEYWORD: "typeTrendingKeyword",
}

const SEVERITY_KEY: Record<string, string> = {
  critical: "sevCritical",
  high: "sevHigh",
  medium: "sevMedium",
  low: "sevLow",
}

function timeAgo(d: string | Date, t: TFn): string {
  const ts = typeof d === "string" ? new Date(d).getTime() : d.getTime()
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return t("justNow")
  if (mins < 60) return t("minAgo", { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("hoursAgo", { n: hours })
  return t("daysAgo", { n: Math.floor(hours / 24) })
}

function metaBadges(meta: unknown, t: TFn): string[] {
  if (!meta || typeof meta !== "object") return []
  const m = meta as Record<string, unknown>
  const badges: string[] = []
  if (typeof m.rank === "number") badges.push(`#${m.rank}`)
  if (typeof m.salesEst === "number") badges.push(t("badgeSales", { n: m.salesEst }))
  if (typeof m.priceDropPct === "number") badges.push(`-${m.priceDropPct}%`)
  if (typeof m.rankGain === "number") badges.push(t("badgeRankGain", { n: m.rankGain }))
  if (typeof m.competitorCount === "number") badges.push(t("badgeSellers", { n: m.competitorCount }))
  return badges
}

export default function RadarAlertsClient({
  initialAlerts,
  unreadCount,
  severityFilter,
  typeFilter,
}: {
  initialAlerts: AlertRow[]
  unreadCount: number
  severityFilter: string
  typeFilter: string
}) {
  const t = useTranslations("radarAlerts")
  const router = useRouter()
  const [alerts, setAlerts] = useState(initialAlerts)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function applyFilters(next: { severity?: string; type?: string }) {
    const params = new URLSearchParams()
    const sev = next.severity ?? severityFilter
    const typ = next.type ?? typeFilter
    if (sev && sev !== "all") params.set("severity", sev)
    if (typ && typ !== "all") params.set("type", typ)
    const qs = params.toString()
    router.push(qs ? `/radar/alerts?${qs}` : "/radar/alerts")
  }

  function markRead(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/radar/alerts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      })
      if (!res.ok) {
        setError(t("markReadFailed"))
        return
      }
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            {t("heading", { n: unreadCount })}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/radar/alerts/settings"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          {t("slackIntegrations")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
          value={severityFilter || "all"}
          onChange={(e) => applyFilters({ severity: e.target.value })}
        >
          <option value="all">{t("sevAll")}</option>
          <option value="critical">{t("sevCritical")}</option>
          <option value="high">{t("sevHigh")}</option>
          <option value="medium">{t("sevMedium")}</option>
          <option value="low">{t("sevLow")}</option>
        </select>
        <select
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
          value={typeFilter || "all"}
          onChange={(e) => applyFilters({ type: e.target.value })}
        >
          <option value="all">{t("typeAll")}</option>
          {(
            [
              "WINNER_NEW",
              "WINNER_RISING",
              "PRICE_WAR",
              "SATURATION_RISK",
              "NEW_LISTING",
            ] as AlertType[]
          ).map((ty) => (
            <option key={ty} value={ty}>
              {t(TYPE_KEY[ty] ?? "typeAll")}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => {
            const sev = alert.severity as Severity
            const badges = metaBadges(alert.meta, t)
            return (
              <li
                key={alert.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  alert.read ? "border-zinc-200 opacity-80" : "border-zinc-300"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          SEVERITY_CLASS[sev] ?? SEVERITY_CLASS.low
                        }`}
                      >
                        {SEVERITY_KEY[alert.severity] ? t(SEVERITY_KEY[alert.severity]!) : alert.severity}
                      </span>
                      <span className="text-sm" aria-hidden>
                        {TYPE_ICON[alert.type] ?? "🚨"}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {TYPE_KEY[alert.type] ? t(TYPE_KEY[alert.type]!) : alert.type}
                      </span>
                      <span className="text-xs text-zinc-400">{timeAgo(alert.createdAt, t)}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-zinc-900">{alert.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{alert.message}</p>
                    {badges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700"
                          >
                            {b}
                          </span>
                        ))}
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                          {alert.marketplaceId} {alert.country ?? ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {!alert.read && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => markRead(alert.id)}
                        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        {t("markRead")}
                      </button>
                    )}
                    <Link
                      href={`/radar/winners?productId=${encodeURIComponent(alert.productId ?? "")}`}
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-zinc-800"
                    >
                      {t("viewProduct")}
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
