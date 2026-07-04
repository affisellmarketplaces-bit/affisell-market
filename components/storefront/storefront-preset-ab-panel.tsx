"use client"

import { CheckCircle2, FlaskConical, ExternalLink, Loader2, Trophy } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import { buildPosthogPresetAbExperimentUrl } from "@/lib/storefront-brand-analytics-shared"
import type { StorefrontPresetAb } from "@/lib/storefront-preset-ab-shared"
import {
  canApplyPresetAbWinner,
  formatPresetAbExperimentStatus,
  formatPresetAbWinnerReason,
  formatPresetAbWinnerVariant,
} from "@/lib/storefront-preset-ab-winner-shared"
import { STOREFRONT_THEME_PRESETS } from "@/lib/storefront-theme-presets"
import { cn } from "@/lib/utils"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  storeSlug: string
  controlPresetId: string | null
  presetAb: StorefrontPresetAb | null | undefined
  onUpdated: () => void
  className?: string
}

function readPosthogProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim()
  return id || null
}

export function StorefrontPresetAbPanel({
  role,
  storeSlug,
  controlPresetId,
  presetAb,
  onUpdated,
  className,
}: Props) {
  const t = useTranslations("storefront.brandStudio.presetAb")
  const locale = useLocale() as "fr" | "en"
  const [challenger, setChallenger] = useState(presetAb?.challengerPresetId ?? "midnight-orbit")
  const [busy, setBusy] = useState(false)
  const [applyingWinner, setApplyingWinner] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (presetAb?.challengerPresetId) setChallenger(presetAb.challengerPresetId)
  }, [presetAb?.challengerPresetId])

  const save = useCallback(
    async (enabled: boolean) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch("/api/store/preset-ab", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled, challengerPresetId: challenger }),
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(json.error ?? t("failed"))
        capturePosthogClient("brand_preset_ab_updated", { role, enabled, challengerPresetId: challenger })
        console.log("[brand-studio]", { event: "preset_ab_updated", role, enabled, result: "ok" })
        onUpdated()
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("failed")
        setError(msg)
      } finally {
        setBusy(false)
      }
    },
    [challenger, onUpdated, role, t]
  )

  const applyWinner = useCallback(async () => {
    setApplyingWinner(true)
    setError(null)
    try {
      const res = await fetch("/api/store/preset-ab/apply-winner", {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? t("applyWinnerFailed"))
      capturePosthogClient("brand_preset_ab_winner_applied", { role, storeSlug })
      console.log("[brand-studio]", { event: "preset_ab_winner_applied", role, result: "ok" })
      onUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("applyWinnerFailed")
      setError(msg)
    } finally {
      setApplyingWinner(false)
    }
  }, [onUpdated, role, storeSlug, t])

  const running = presetAb?.enabled === true
  const winnerApplied = Boolean(presetAb?.winnerAppliedAt && presetAb.winnerVariant)
  const canApplyWinner = presetAb ? canApplyPresetAbWinner(presetAb) : false
  const experimentStatus =
    running && presetAb ? formatPresetAbExperimentStatus({ presetAb, locale }) : null
  const projectId = readPosthogProjectId()
  const abExperimentUrl =
    running && projectId && storeSlug.trim()
      ? buildPosthogPresetAbExperimentUrl({
          projectId,
          storeSlug: storeSlug.trim(),
          captureHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        })
      : null

  function openAbExperiment() {
    if (!abExperimentUrl) return
    capturePosthogClient("brand_preset_ab_insight_opened", { role, storeSlug })
    window.open(abExperimentUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <BentoCard
      className={cn(
        "border-cyan-300/60 bg-gradient-to-br from-cyan-50/80 via-white to-sky-50/40 dark:border-cyan-900/40 dark:from-cyan-950/20 dark:via-zinc-950 dark:to-sky-950/15",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-cyan-950 dark:text-cyan-100">
        <FlaskConical className="size-4 text-cyan-600" aria-hidden />
        {t("title")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-cyan-900/75 dark:text-cyan-100/75">{t("subtitle")}</p>

      {winnerApplied && presetAb?.winnerVariant ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
            <Trophy className="size-3.5 text-emerald-600" aria-hidden />
            {t("winnerApplied", {
              winner: formatPresetAbWinnerVariant({ variant: presetAb.winnerVariant, locale }),
            })}
          </p>
          {presetAb.winnerReason ? (
            <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
              {formatPresetAbWinnerReason({ reason: presetAb.winnerReason, locale })}
            </p>
          ) : null}
        </div>
      ) : null}

      {experimentStatus ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-cyan-900/80 dark:text-cyan-100/80">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-cyan-600" aria-hidden />
          {experimentStatus}
        </p>
      ) : null}

      <label className="mt-4 block space-y-1">
        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{t("challenger")}</span>
        <select
          value={challenger}
          disabled={busy || running}
          onChange={(e) => setChallenger(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {STOREFRONT_THEME_PRESETS.filter((p) => p.id !== controlPresetId).map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
      </label>

      {running && presetAb ? (
        <p className="mt-3 text-xs text-zinc-700 dark:text-zinc-300">
          {t("stats", {
            control: presetAb.viewsControl,
            challenger: presetAb.viewsChallenger,
          })}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!running ? (
          <button
            type="button"
            disabled={busy || !controlPresetId}
            onClick={() => void save(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("start")}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-900 dark:border-cyan-800 dark:text-cyan-100"
            >
              {t("stop")}
            </button>
            {abExperimentUrl ? (
              <button
                type="button"
                onClick={openAbExperiment}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-900 dark:border-cyan-800 dark:bg-zinc-950 dark:text-cyan-100"
              >
                {t("openPosthog")}
                <ExternalLink className="size-3.5" aria-hidden />
              </button>
            ) : null}
            {canApplyWinner ? (
              <button
                type="button"
                disabled={applyingWinner}
                onClick={() => void applyWinner()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {applyingWinner ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("applyWinner")}
              </button>
            ) : null}
          </>
        )}
      </div>
      {!controlPresetId ? (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{t("needPreset")}</p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-rose-600">{error}</p> : null}
    </BentoCard>
  )
}
