"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { CheckCircle2, ListChecks, Loader2, Undo2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import type { ActionReason, ActionType, PlannedAction } from "@/lib/reseller-action-plan"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

const MAX_ROWS = 6

const REASON_KEYS: Record<ActionReason, string> = {
  supplier_price_at_or_above_selling: "reasonSupplierPriceAbove",
  net_insufficient: "reasonNetInsufficient",
  net_thin: "reasonNetThin",
  refund_rate_rising: "reasonRefundRising",
  supplier_price_changed: "reasonSupplierPriceChanged",
  cost_drift_up: "reasonCostDriftUp",
  demand_rising: "reasonDemandRising",
  traffic_without_sales: "reasonTrafficWithoutSales",
  top_opportunity: "reasonTopOpportunity",
}

const ACTION_KEYS: Record<ActionType, string> = {
  reprice: "actionReprice",
  pause: "actionPause",
  fix_margins: "actionFixMargins",
  review_refunds: "actionReviewRefunds",
  review_pricing: "actionReviewPricing",
  push_momentum: "actionPushMomentum",
  list_opportunity: "actionListOpportunity",
  review_traffic: "actionReviewTraffic",
}

type RowState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "applied"; auditId: string }
  | { kind: "undone" }
  | { kind: "error"; code: string }

function euros(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100)
}

function href(a: PlannedAction): string {
  if (a.type === "list_opportunity") return `${AFFILIATE_CATALOG_PATH}?q=${encodeURIComponent(a.name)}`
  return a.listingId ? `/dashboard/affiliate/products/${encodeURIComponent(a.listingId)}/edit` : AFFILIATE_CATALOG_PATH
}

/**
 * The reseller's action plan: each row says WHAT to do, WHY (reason chips) and the estimated net per sale before/after.
 * One-click actions are applied only on an explicit click, recomputed server-side (stale → refused) and undoable.
 */
export function AffiliateActionPlanCard({ actions, className }: { actions: PlannedAction[]; className?: string }) {
  const t = useTranslations("affiliate.actionPlan")
  const locale = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [rows, setRows] = useState<Record<string, RowState>>({})

  if (actions.length === 0) return null

  const set = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: s }))

  async function apply(a: PlannedAction) {
    set(a.id, { kind: "busy" })
    const res = await fetch("/api/affiliate/copilot/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId: a.id }),
    }).catch(() => null)
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; auditId?: string; error?: string } | null
    if (res?.ok && data?.ok && data.auditId) set(a.id, { kind: "applied", auditId: data.auditId })
    else set(a.id, { kind: "error", code: data?.error ?? "failed" })
  }

  async function undo(a: PlannedAction, auditId: string) {
    set(a.id, { kind: "busy" })
    const res = await fetch("/api/affiliate/copilot/actions/undo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ auditId }),
    }).catch(() => null)
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (res?.ok && data?.ok) set(a.id, { kind: "undone" })
    else set(a.id, { kind: "error", code: data?.error ?? "failed" })
  }

  const errorText = (code: string) =>
    code === "stale"
      ? t("errorStale")
      : code === "changed_since"
        ? t("errorChangedSince")
        : code === "kyc_required"
          ? t("errorKyc")
          : code === "expired"
            ? t("errorExpired")
            : t("errorGeneric")

  return (
    <section
      className={cn(
        "rounded-2xl border border-violet-200/80 bg-white p-4 shadow-sm dark:border-violet-900/50 dark:bg-zinc-950 sm:p-5",
        className,
      )}
      data-testid="affiliate-action-plan"
      aria-labelledby="affiliate-action-plan-heading"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        <ListChecks className="size-4" aria-hidden />
        {t("eyebrow")}
      </p>
      <h2 id="affiliate-action-plan-heading" className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {t("title", { count: actions.length })}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("hint")}</p>

      <ol className="mt-4 space-y-2">
        {actions.slice(0, MAX_ROWS).map((a) => {
          const state = rows[a.id] ?? { kind: "idle" }
          return (
            <li
              key={a.id}
              className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t(ACTION_KEYS[a.type], {
                      price: a.suggestedPriceCents != null ? euros(a.suggestedPriceCents, locale) : "",
                    })}
                  </p>
                  <Link
                    href={href(a)}
                    className="block truncate text-sm text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    {a.name}
                  </Link>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {a.reasons.map((r) => (
                      <li
                        key={r}
                        className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-100"
                      >
                        {t(REASON_KEYS[r])}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right text-xs text-zinc-600 dark:text-zinc-400">
                  {a.expectedNetNowCents != null ? (
                    <p>
                      {t("netNow")}{" "}
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {euros(a.expectedNetNowCents, locale)}
                      </span>
                    </p>
                  ) : null}
                  {a.expectedNetAfterCents != null ? (
                    <p>
                      {t(a.type === "list_opportunity" ? "netPerSale" : "netAfter")}{" "}
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {euros(a.expectedNetAfterCents, locale)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2" aria-live="polite">
                {a.autonomy === "one_click" && (state.kind === "idle" || state.kind === "error") ? (
                  <button
                    type="button"
                    onClick={() => void apply(a)}
                    className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    {t("apply")}
                  </button>
                ) : null}
                {a.autonomy === "recommend" ? (
                  <Link
                    href={href(a)}
                    className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                  >
                    {t("open")}
                  </Link>
                ) : null}
                {state.kind === "busy" ? (
                  <Loader2 className="size-4 animate-spin text-zinc-500" aria-label={t("busy")} />
                ) : null}
                {state.kind === "applied" ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {t("applied")}
                    </span>
                    <button
                      type="button"
                      onClick={() => void undo(a, state.auditId)}
                      className="flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                    >
                      <Undo2 className="size-3.5" aria-hidden />
                      {t("undo")}
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => router.refresh())}
                      className="text-xs text-zinc-500 hover:underline"
                    >
                      {t("refresh")}
                    </button>
                  </>
                ) : null}
                {state.kind === "undone" ? <span className="text-xs text-zinc-600">{t("undone")}</span> : null}
                {state.kind === "error" ? (
                  <span className="text-xs text-rose-700 dark:text-rose-400" role="alert">
                    {errorText(state.code)}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-[11px] text-zinc-500">{t("estimateNote")}</p>
    </section>
  )
}
