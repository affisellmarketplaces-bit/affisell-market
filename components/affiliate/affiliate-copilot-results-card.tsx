import { Gauge } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import type { AccuracyStats } from "@/lib/copilot-accuracy"
import { ACCURACY_MIN_ORDERS } from "@/lib/copilot-accuracy"
import type { OutcomeVerdict } from "@/lib/copilot-outcomes"
import { cn } from "@/lib/utils"

const MAX_OUTCOMES = 5

const VERDICT_KEYS: Record<AccuracyStats["verdict"], string> = {
  reliable: "accuracyReliable",
  biased: "accuracyBiased",
  imprecise: "accuracyImprecise",
  insufficient_data: "accuracyInsufficient",
}

const OUTCOME_KEYS: Record<OutcomeVerdict, string> = {
  beneficial: "outcomeBeneficial",
  neutral: "outcomeNeutral",
  unfavourable: "outcomeUnfavourable",
  insufficient_data: "outcomeInsufficient",
  too_early: "outcomeTooEarly",
}

const OUTCOME_TONE: Record<OutcomeVerdict, string> = {
  beneficial: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  neutral: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  unfavourable: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
  insufficient_data: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  too_early: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
}

const ACTION_KEYS: Record<string, string> = {
  reprice: "typeReprice",
  pause: "typePause",
  fix_margins: "typeFixMargins",
}

type Props = {
  accuracy: AccuracyStats
  outcomes: Array<{ auditId: string; type: string; appliedAt: string; outcome: { verdict: OutcomeVerdict } }>
  className?: string
}

function euros(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100)
}

/**
 * "Is the copilot right for me?" — server-rendered (no hydration). Four amounts kept apart (estimated, due, paid,
 * still owed), the accuracy verdict with its volume, and what each applied action did. Hidden with no data at all.
 */
export function AffiliateCopilotResultsCard({ accuracy, outcomes, className }: Props) {
  const t = useTranslations("affiliate.copilotResults")
  const locale = useLocale()
  if (accuracy.orders === 0 && outcomes.length === 0) return null
  const totals = accuracy.totals
  const amount = (label: string, cents: number) => (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-900">
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{euros(cents, locale)}</dd>
    </div>
  )
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5",
        className,
      )}
      data-testid="affiliate-copilot-results"
      aria-labelledby="affiliate-copilot-results-heading"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
        <Gauge className="size-4" aria-hidden />
        {t("eyebrow")}
      </p>
      <h2 id="affiliate-copilot-results-heading" className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {t(VERDICT_KEYS[accuracy.verdict], { orders: accuracy.orders, min: ACCURACY_MIN_ORDERS })}
      </h2>
      {accuracy.orders > 0 ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("accuracyDetail", {
            mae: euros(accuracy.maeCents, locale),
            bias: euros(accuracy.biasCents, locale),
            exact: Math.round(accuracy.exactShare * 100),
          })}
        </p>
      ) : null}

      {accuracy.orders > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {amount(t("amountEstimated"), totals.estimated)}
          {amount(t("amountDue"), totals.due)}
          {amount(t("amountPaid"), totals.paid)}
          {amount(t("amountOutstanding"), totals.outstanding)}
        </dl>
      ) : null}

      {outcomes.length > 0 ? (
        <>
          <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("outcomesTitle")}</h3>
          <ul className="mt-2 space-y-1.5">
            {outcomes.slice(0, MAX_OUTCOMES).map((o) => (
              <li key={o.auditId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {t(ACTION_KEYS[o.type] ?? "typeOther")} ·{" "}
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
                    new Date(o.appliedAt),
                  )}
                </span>
                <span
                  className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", OUTCOME_TONE[o.outcome.verdict])}
                >
                  {t(OUTCOME_KEYS[o.outcome.verdict])}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-3 text-[11px] text-zinc-500">{t("note")}</p>
    </section>
  )
}
