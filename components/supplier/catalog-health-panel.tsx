"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { AvailabilityImpact, AvailabilityImpactItem } from "@/lib/supplier-catalog-health/availability-impact"
import type { HealthClass, HealthIssue, HealthReport } from "@/lib/supplier-catalog-health/diagnose"

type HealthPayload = HealthReport & { availability?: AvailabilityImpact }
const money = (c: number) => formatStoreCurrencyFromCents(c, { maximumFractionDigits: 0 })

const CLASSES: HealthClass[] = ["blocage", "anomalie", "avertissement", "recommandation"]
const CLASS_STYLE: Record<HealthClass, string> = {
  blocage: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  anomalie: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  avertissement: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  recommandation: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
}
const PAGE = 25

/** Message params: only numbers / short strings from the evidence (booleans → 0/1 for ICU selects). */
function params(i: HealthIssue): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(i.evidence)) {
    if (typeof v === "number" || typeof v === "string") out[k] = v
    else if (typeof v === "boolean") out[k] = v ? 1 : 0
  }
  return out
}

/**
 * Supplier catalogue health (lib/supplier-catalog-health/diagnose.ts): what stops products from selling, ranked by
 * observed demand, each with its reason and the data it rests on. Recommendations are optional and labelled so.
 */
export function CatalogHealthPanel() {
  const t = useTranslations("catalogHealth")
  const [report, setReport] = useState<HealthPayload | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [filter, setFilter] = useState<HealthClass | "all">("all")
  const [shown, setShown] = useState(PAGE)

  const load = useCallback(async () => {
    setState("loading")
    const res = await fetch("/api/supplier/catalog-health", { cache: "no-store", credentials: "include" }).catch(() => null)
    if (!res?.ok) {
      setState("error")
      return
    }
    setReport((await res.json()) as HealthPayload)
    setState("ready")
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const issues = useMemo(
    () => (report?.issues ?? []).filter((i) => filter === "all" || i.cls === filter),
    [report, filter]
  )

  if (state === "loading") return <p className="text-sm text-zinc-500">{t("loading")}</p>
  if (state === "error" || !report) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p>{t("error")}</p>
        <button type="button" className="mt-2 text-sm font-medium text-violet-700 underline" onClick={() => void load()}>
          {t("retry")}
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="catalog-health-title">
      <header className="space-y-1">
        <h1 id="catalog-health-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        <p className="text-xs text-zinc-500">
          {t("summary", {
            checked: report.productsChecked,
            blocked: report.blockedProducts,
            healthy: report.healthyProducts,
          })}
          {report.truncated ? ` ${t("truncated")}` : ""}
        </p>
      </header>

      {report.availability ? <AvailabilityImpactSection impact={report.availability} onFixed={() => void load()} /> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("filterLabel")}>
        {(["all", ...CLASSES] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={filter === c}
            onClick={() => {
              setFilter(c)
              setShown(PAGE)
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === c ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {c === "all"
              ? t("filterAll", { count: report.issues.length })
              : `${t(`class.${c}.label`)} (${report.counts[c]})`}
          </button>
        ))}
      </div>
      {filter !== "all" ? <p className="text-xs text-zinc-500">{t(`class.${filter}.definition`)}</p> : null}

      {issues.length === 0 ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {report.productsChecked === 0 ? t("emptyCatalogue") : t("nothingHere")}
        </p>
      ) : (
        <ul className="space-y-2">
          {issues.slice(0, shown).map((i) => (
            <IssueRow key={`${i.productId}:${i.code}`} issue={i} onFixed={() => void load()} />
          ))}
        </ul>
      )}
      {issues.length > shown ? (
        <button type="button" className="text-sm font-medium text-violet-700 underline" onClick={() => setShown((n) => n + PAGE)}>
          {t("showMore", { count: issues.length - shown })}
        </button>
      ) : null}
      <p className="text-xs text-zinc-500">{t("method")}</p>
    </section>
  )
}

/**
 * « Disponibilité chez vos revendeurs »: for every product in at least one reseller shop with an availability problem —
 * how many shops show it, what it did in the last 30 days (observed, never a forecast), the cause in one sentence and
 * the fix right there (quantity, reactivate your own pause, open the sheet).
 */
function AvailabilityImpactSection({ impact, onFixed }: { impact: AvailabilityImpact; onFixed: () => void }) {
  const t = useTranslations("catalogHealth.availability")
  const [open, setOpen] = useState(false)
  const items = open ? impact.items : impact.items.slice(0, 5)
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800" aria-labelledby="availability-impact-title">
      <h2 id="availability-impact-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h2>
      {impact.items.length === 0 ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200">{t("none")}</p>
      ) : (
        <>
          {impact.totals.blockedProducts > 0 ? (
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {t("summaryBlocked", {
                products: impact.totals.blockedProducts,
                shops: impact.totals.blockedShops,
                orders: impact.totals.blockedOrders30d,
                amount: money(impact.totals.blockedSupplierAmount30dCents),
              })}
            </p>
          ) : null}
          {impact.totals.atRiskProducts > 0 ? (
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {t("summaryAtRisk", { products: impact.totals.atRiskProducts, shops: impact.totals.atRiskShops })}
            </p>
          ) : null}
          <ul className="space-y-2">
            {items.map((i) => (
              <AvailabilityRow key={i.productId} item={i} onFixed={onFixed} />
            ))}
          </ul>
          {impact.items.length > 5 ? (
            <button type="button" className="text-sm font-medium text-violet-700 underline" onClick={() => setOpen((v) => !v)}>
              {open ? t("showLess") : t("showAll", { count: impact.items.length })}
            </button>
          ) : null}
        </>
      )}
      <p className="text-xs text-zinc-500">{t("method")}</p>
    </section>
  )
}

function AvailabilityRow({ item, onFixed }: { item: AvailabilityImpactItem; onFixed: () => void }) {
  const t = useTranslations("catalogHealth.availability")
  const tIssue = useTranslations("catalogHealth")
  const p: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(item.evidence)) {
    if (typeof v === "number" || typeof v === "string") p[k] = v
    else if (typeof v === "boolean") p[k] = v ? 1 : 0
  }
  const blocked = item.severity === "blocked"
  return (
    <li className={`rounded-xl border p-3 ${blocked ? "border-red-200 dark:border-red-900" : "border-amber-200 dark:border-amber-900"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            blocked ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          }`}
        >
          {t(`severity.${item.severity}`)}
        </span>
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.productName}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {t(blocked ? "shopsBlocked" : "shopsAtRisk", { shops: item.shops })}
      </p>
      <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
        {t("observed", { orders: item.paidOrders30d, units: item.units30d, amount: money(item.supplierAmount30dCents) })}{" "}
        {item.daysSinceLastSale == null ? t("neverSold") : t("lastSale", { days: item.daysSinceLastSale })}
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">{t("cause")}</span> {tIssue(`issues.${item.code}.why`, p)}
      </p>
      {item.alsoCodes.length > 0 ? (
        <p className="mt-0.5 text-xs text-zinc-500">
          {t("also")} {item.alsoCodes.map((c) => tIssue(`issues.${c}.title`)).join(" · ")}
        </p>
      ) : null}
      <div className="mt-2">
        {item.fix === "set_stock" ? (
          <StockFix
            productId={item.productId}
            current={typeof item.evidence.stock === "number" ? item.evidence.stock : typeof item.evidence.available === "number" ? item.evidence.available : null}
            onFixed={onFixed}
          />
        ) : item.fix === "reactivate" ? (
          <ReactivateFix productId={item.productId} onFixed={onFixed} />
        ) : item.fix === "edit_product" ? (
          <Link href={`/dashboard/supplier/products/${encodeURIComponent(item.productId)}/edit`} className="text-sm font-medium text-violet-700 underline">
            {tIssue("fix.edit")}
          </Link>
        ) : item.fix === "view_hold" ? (
          <p className="text-xs text-zinc-500">{tIssue("fix.hold")}</p>
        ) : null}
      </div>
    </li>
  )
}

/** Lift the supplier's OWN pause through the existing route; an Affisell hold or an unconfirmed quantity is refused there. */
function ReactivateFix({ productId, onFixed }: { productId: string; onFixed: () => void }) {
  const t = useTranslations("catalogHealth.availability")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const go = async () => {
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: true }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error
      const known = code === "product_recalled" || code === "product_suspended" || code === "stock_unconfirmed"
      setMsg(known ? t(`refused.${code}`) : t("reactivateError"))
      return
    }
    setMsg(t("reactivated"))
    onFixed()
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => void go()} className="h-8 rounded-md bg-violet-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
        {busy ? t("reactivating") : t("reactivate")}
      </button>
      {msg ? <span className="text-xs text-zinc-600 dark:text-zinc-400" role="status">{msg}</span> : null}
    </div>
  )
}

function IssueRow({ issue, onFixed }: { issue: HealthIssue; onFixed: () => void }) {
  const t = useTranslations("catalogHealth")
  const p = params(issue)
  return (
    <li className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASS_STYLE[issue.cls]}`}>
          {t(`class.${issue.cls}.label`)}
        </span>
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{issue.productName}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{t(`issues.${issue.code}.title`)}</p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{t(`issues.${issue.code}.why`, p)}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        {t(`source.${issue.source}`)}
        {issue.demand.paidOrders30d + issue.demand.resellersListing > 0
          ? ` · ${t("demandLine", { orders: issue.demand.paidOrders30d, resellers: issue.demand.resellersListing })}`
          : ""}
      </p>
      <div className="mt-2">
        {issue.fix === "set_stock" ? (
          <StockFix productId={issue.productId} current={typeof issue.evidence.stock === "number" ? issue.evidence.stock : typeof issue.evidence.available === "number" ? issue.evidence.available : null} onFixed={onFixed} />
        ) : issue.fix === "edit_product" ? (
          <Link
            href={`/dashboard/supplier/products/${encodeURIComponent(issue.productId)}/edit`}
            className="text-sm font-medium text-violet-700 underline"
          >
            {t("fix.edit")}
          </Link>
        ) : issue.fix === "view_hold" ? (
          <p className="text-xs text-zinc-500">{t("fix.hold")}</p>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Inline quantity fix (simple products only — the diagnosis offers it only without SKU rows). Goes through the existing
 * supplier PATCH with `stockBaseline`, so units sold since the page was loaded are never resurrected.
 */
function StockFix({ productId, current, onFixed }: { productId: string; current: number | null; onFixed: () => void }) {
  const t = useTranslations("catalogHealth")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    const qty = value.trim()
    if (!/^\d{1,7}$/.test(qty)) {
      setMsg(t("fix.stockInvalid"))
      return
    }
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ hasVariants: false, variants: [], stock: Number(qty), stockBaseline: current }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      setMsg(t("fix.stockError"))
      return
    }
    setMsg(t("fix.stockSaved"))
    onFixed()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-zinc-600 dark:text-zinc-400" htmlFor={`stock-${productId}`}>
        {t("fix.stockLabel")}
      </label>
      <input
        id={`stock-${productId}`}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-24 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="h-8 rounded-md bg-violet-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("fix.saving") : t("fix.stockSave")}
      </button>
      {msg ? <span className="text-xs text-zinc-600 dark:text-zinc-400" role="status">{msg}</span> : null}
    </div>
  )
}
