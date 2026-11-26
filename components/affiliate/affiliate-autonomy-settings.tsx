"use client"

import { useState } from "react"
import { Bot } from "lucide-react"
import { useTranslations } from "next-intl"

import { AUTO_ELIGIBLE_TYPES, DEFAULT_RULE, type AutoEligibleType, type AutonomyRule } from "@/lib/copilot-autonomy"
import { cn } from "@/lib/utils"

const PRICE_OPTIONS = [500, 1000, 1500, 2000, 2500]
const RUN_OPTIONS = [1, 3, 5, 10]

type Props = { rules: AutonomyRule[]; available: boolean; className?: string }

/**
 * Per-action-type autonomy grants. Nothing is granted by default; each grant states its exact limits, needs an
 * explicit consent tick, is revocable in one click and is recorded (AuditLog). Pausing is never offered.
 */
export function AffiliateAutonomySettings({ rules, available, className }: Props) {
  const t = useTranslations("affiliate.autonomy")
  const [state, setState] = useState<Record<string, AutonomyRule | undefined>>(
    Object.fromEntries(rules.filter((r) => !r.revokedAt).map((r) => [r.actionType, r])),
  )
  const [draft, setDraft] = useState<Record<string, { bps: number; runs: number; consent: boolean }>>(
    Object.fromEntries(
      AUTO_ELIGIBLE_TYPES.map((type) => [
        type,
        { bps: DEFAULT_RULE.maxPriceIncreaseBps, runs: DEFAULT_RULE.maxRunsPerWeek, consent: false },
      ]),
    ),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function grant(type: AutoEligibleType) {
    const d = draft[type]!
    setBusy(type)
    setError(null)
    const res = await fetch("/api/affiliate/copilot/autonomy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionType: type,
        maxPriceIncreaseBps: d.bps,
        maxRunsPerWeek: d.runs,
        consent: d.consent,
      }),
    }).catch(() => null)
    setBusy(null)
    if (res?.ok) {
      setState((s) => ({
        ...s,
        [type]: {
          actionType: type,
          maxPriceIncreaseBps: d.bps,
          maxRunsPerWeek: d.runs,
          grantedAt: new Date().toISOString(),
          revokedAt: null,
        },
      }))
      setDraft((x) => ({ ...x, [type]: { ...x[type]!, consent: false } }))
    } else setError(type)
  }

  async function revoke(type: AutoEligibleType) {
    setBusy(type)
    setError(null)
    const res = await fetch(`/api/affiliate/copilot/autonomy?actionType=${type}`, { method: "DELETE" }).catch(
      () => null,
    )
    setBusy(null)
    if (res?.ok) setState((s) => ({ ...s, [type]: undefined }))
    else setError(type)
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5",
        className,
      )}
      data-testid="affiliate-autonomy-settings"
      aria-labelledby="affiliate-autonomy-heading"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
        <Bot className="size-4" aria-hidden />
        {t("eyebrow")}
      </p>
      <h2 id="affiliate-autonomy-heading" className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("hint")}</p>
      {!available ? <p className="mt-3 text-sm text-zinc-500">{t("unavailable")}</p> : null}

      {available ? (
        <ul className="mt-4 space-y-3">
          {AUTO_ELIGIBLE_TYPES.map((type) => {
            const active = state[type]
            const d = draft[type]!
            return (
              <li key={type} className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t(`${type}Title`)}</p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t(`${type}Explain`)}</p>
                {active ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {type === "reprice"
                        ? t("activeReprice", { pct: active.maxPriceIncreaseBps / 100, runs: active.maxRunsPerWeek })
                        : t("activeFixMargins", { runs: active.maxRunsPerWeek })}
                    </p>
                    <button
                      type="button"
                      disabled={busy === type}
                      onClick={() => void revoke(type)}
                      className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      {t("revoke")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {type === "reprice" ? (
                        <label className="flex items-center gap-1.5">
                          {t("maxIncrease")}
                          <select
                            value={d.bps}
                            onChange={(e) => setDraft((x) => ({ ...x, [type]: { ...d, bps: Number(e.target.value) } }))}
                            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {PRICE_OPTIONS.map((v) => (
                              <option key={v} value={v}>
                                {v / 100} %
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className="flex items-center gap-1.5">
                        {t("maxRuns")}
                        <select
                          value={d.runs}
                          onChange={(e) => setDraft((x) => ({ ...x, [type]: { ...d, runs: Number(e.target.value) } }))}
                          className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          {RUN_OPTIONS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={d.consent}
                        onChange={(e) => setDraft((x) => ({ ...x, [type]: { ...d, consent: e.target.checked } }))}
                        className="mt-0.5"
                      />
                      <span>
                        {type === "reprice"
                          ? t("consentReprice", { pct: d.bps / 100, runs: d.runs })
                          : t("consentFixMargins", { runs: d.runs })}
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={!d.consent || busy === type}
                      onClick={() => void grant(type)}
                      className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-40"
                    >
                      {t("grant")}
                    </button>
                  </div>
                )}
                {error === type ? (
                  <p className="mt-1 text-xs text-rose-700" role="alert">
                    {t("error")}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <p className="mt-3 text-[11px] text-zinc-500">{t("never")}</p>
    </section>
  )
}
