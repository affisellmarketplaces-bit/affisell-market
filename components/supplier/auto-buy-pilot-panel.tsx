"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Bot, Loader2, Radar, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import type {
  AutoBuyPilotSnapshot,
  AutoBuyPilotSku,
} from "@/lib/supplier/load-auto-buy-pilot"
import { cn } from "@/lib/utils"

const BAND_STYLES: Record<string, { badge: string; bar: string }> = {
  excellent: {
    badge: "border-emerald-400/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  good: {
    badge: "border-sky-400/30 bg-sky-500/15 text-sky-600 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  warning: {
    badge: "border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  loss: {
    badge: "border-red-400/30 bg-red-500/15 text-red-700 dark:text-red-300",
    bar: "bg-red-500",
  },
  unknown: {
    badge: "border-zinc-400/30 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
    bar: "bg-zinc-400",
  },
}

function eur(cents: number | null | undefined): string {
  if (cents == null) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  )
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value.toFixed(value >= 10 || value <= -10 ? 0 : 1)} %`
}

function Toggle({
  on,
  busy,
  label,
  onChange,
}: {
  on: boolean
  busy?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        on
          ? "border-violet-500/50 bg-violet-600"
          : "border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-6" : "translate-x-1"
        )}
        aria-hidden
      />
    </button>
  )
}

export function AutoBuyPilotPanel({ snapshot }: { snapshot: AutoBuyPilotSnapshot }) {
  const t = useTranslations("supplierDashboard.autoBuyPilot")
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const { skus, summary, radar, windowDays } = snapshot
  const allOn = summary.totalSkus > 0 && summary.autoBuyOnCount === summary.totalSkus

  async function patch(body: Record<string, unknown>, pendingKey: string) {
    setPendingId(pendingKey)
    try {
      const res = await fetch("/api/supplier/auto-buy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "toggle_failed")
      toast.success(t("toggleSaved"))
      startTransition(() => router.refresh())
    } catch {
      toast.error(t("toggleError"))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section
      aria-labelledby="auto-buy-pilot-heading"
      className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-zinc-950 via-violet-950/80 to-zinc-900 text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15">
            <Bot className="h-5 w-5 text-violet-300" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="auto-buy-pilot-heading" className="text-lg font-bold tracking-tight">
              {t("title")}
            </h3>
            <p className="text-xs text-zinc-400">{t("subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("masterSwitch")}
            </p>
            <p className="text-xs tabular-nums text-zinc-300">
              {t("skusOn", { on: summary.autoBuyOnCount, total: summary.totalSkus })}
            </p>
          </div>
          <Toggle
            on={allOn}
            busy={pendingId === "all" || isRefreshing}
            label={t("masterSwitch")}
            onChange={(next) => void patch({ scope: "all", enabled: next }, "all")}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-b border-white/10 p-5 sm:grid-cols-4 sm:p-6">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("kpi.health")}
          </dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums">
            {summary.avgHealthScore != null ? `${summary.avgHealthScore}/100` : "—"}
          </dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("kpi.orders", { days: windowDays })}
          </dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums">{summary.realizedOrders30d}</dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("kpi.margin", { days: windowDays })}
          </dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-emerald-300">
            {eur(summary.realizedMarginCents30d)}
          </dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("kpi.atRisk")}
          </dt>
          <dd
            className={cn(
              "mt-0.5 text-xl font-bold tabular-nums",
              summary.lossCount > 0 ? "text-red-400" : "text-zinc-300"
            )}
          >
            {summary.lossCount}
          </dd>
        </div>
      </dl>

      <div className="p-5 sm:p-6">
        {skus.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-zinc-400">
            {t("empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {skus.map((sku) => (
              <PilotSkuRow
                key={sku.productId}
                sku={sku}
                busy={pendingId === sku.productId || isRefreshing}
                onToggle={(next) =>
                  void patch(
                    { scope: "product", productId: sku.productId, enabled: next },
                    sku.productId
                  )
                }
              />
            ))}
          </ul>
        )}
      </div>

      {radar.length > 0 ? (
        <div className="border-t border-white/10 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-violet-300" aria-hidden />
            <h4 className="text-sm font-semibold">{t("radar.title", { days: windowDays })}</h4>
          </div>
          <p className="mt-1 text-xs text-zinc-400">{t("radar.subtitle")}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {radar.map((cat) => (
              <li
                key={cat.categoryId}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="truncate text-sm font-semibold">{cat.name}</p>
                <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
                  {t("radar.orders", { count: cat.orders30d })} ·{" "}
                  {t("radar.avgPrice", { price: eur(cat.avgSellingCents) })}
                </p>
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    cat.supplierHasListing
                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                      : "border-violet-400/40 bg-violet-500/20 text-violet-200"
                  )}
                >
                  {cat.supplierHasListing ? t("radar.covered") : t("radar.opportunity")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function PilotSkuRow({
  sku,
  busy,
  onToggle,
}: {
  sku: AutoBuyPilotSku
  busy: boolean
  onToggle: (next: boolean) => void
}) {
  const t = useTranslations("supplierDashboard.autoBuyPilot")
  const eco = sku.economics
  const styles = BAND_STYLES[eco.healthBand] ?? BAND_STYLES.unknown
  const underpriced =
    eco.suggestedPriceCents != null && eco.suggestedPriceCents > sku.sellingPriceCents

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
          {sku.image ? (
            <Image src={sku.image} alt="" fill sizes="40px" className="object-cover" unoptimized />
          ) : (
            <TrendingUp className="m-auto h-4 w-4 text-zinc-600" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{sku.name}</p>
          <p className="text-xs tabular-nums text-zinc-400">
            {t("row.price")} {eur(sku.sellingPriceCents)} · {t("row.cogs")} {eur(sku.cogsCents)} ·{" "}
            {t("row.net")}{" "}
            <span
              className={cn(
                "font-semibold",
                (eco.netMarginCents ?? 0) < 0 ? "text-red-400" : "text-emerald-300"
              )}
            >
              {eur(eco.netMarginCents)} ({pct(eco.netMarginPct)})
            </span>
            {sku.realized ? (
              <> · {t("row.sold", { count: sku.realized.orders })}</>
            ) : null}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            styles.badge
          )}
        >
          {eco.healthScore != null ? `${eco.healthScore}` : "?"} · {t(`bands.${eco.healthBand}`)}
        </span>

        {busy ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden /> : null}
        <Toggle on={sku.autoBuyEnabled} busy={busy} label={t("row.toggle")} onChange={onToggle} />
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-all", styles.bar)}
          style={{ width: `${eco.healthScore ?? 0}%` }}
        />
      </div>

      {underpriced ? (
        <p className="mt-2 text-xs text-amber-300">
          {t("row.suggestion", {
            suggested: eur(eco.suggestedPriceCents),
            breakEven: eur(eco.breakEvenPriceCents),
          })}
        </p>
      ) : null}
    </li>
  )
}
