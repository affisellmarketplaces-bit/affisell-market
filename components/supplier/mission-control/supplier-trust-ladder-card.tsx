"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useId, useState } from "react"

import {
  missionControlAffisellCard,
  missionControlAffisellEyebrow,
  missionControlAffisellInnerPanel,
  missionControlAffisellMuted,
  missionControlAffisellOverlayIndigo,
  missionControlAffisellOverlayViolet,
  missionControlAffisellScanline,
  missionControlAffisellSubtext,
  missionControlAffisellToggle,
  missionControlHeading,
  missionControlProgressTrack,
  missionControlStepLocked,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { OrbitalTrustIcon, SupplierTrustBadge } from "@/components/suppliers/supplier-trust-badge"
import {
  buildTrustTierProgress,
  formatTrustOrderCount,
  SUPPLIER_TRUST_TIER_META,
  SUPPLIER_TRUST_THRESHOLDS,
  trustTierRank,
  type SupplierTrustMetrics,
  type SupplierTrustTier,
} from "@/lib/supplier/supplier-trust-tier-shared"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "affisell:supplier-trust-ladder-open"

type Props = {
  tier: SupplierTrustTier
  metrics: SupplierTrustMetrics
  locale?: "fr" | "en"
  className?: string
}

const LADDER: Exclude<SupplierTrustTier, "NONE">[] = ["SPARK", "FORGE", "ORBITAL"]

function ladderStepClass(step: (typeof LADDER)[number], active: boolean, unlocked: boolean): string {
  if (active) {
    if (step === "SPARK") {
      return "border-amber-300/70 bg-amber-50/90 ring-1 ring-amber-300/40 dark:border-amber-400/50 dark:bg-amber-500/10 dark:ring-amber-400/35"
    }
    if (step === "FORGE") {
      return "border-violet-300/70 bg-violet-50/90 ring-1 ring-violet-300/40 dark:border-violet-400/50 dark:bg-violet-500/10 dark:ring-violet-400/35"
    }
    return "border-sky-300/70 bg-sky-50/90 ring-1 ring-sky-300/40 dark:border-sky-400/50 dark:bg-sky-500/10 dark:ring-sky-400/35"
  }
  if (unlocked) {
    return "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5"
  }
  return missionControlStepLocked
}

function pct(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function readPersistedOpen(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function buildCollapsedSummary(
  locale: "fr" | "en",
  tier: SupplierTrustTier,
  progress: ReturnType<typeof buildTrustTierProgress>
): string {
  const currentLabel =
    tier === "NONE"
      ? locale === "fr"
        ? "Aucun badge"
        : "No badge"
      : locale === "fr"
        ? SUPPLIER_TRUST_TIER_META[tier].shortFr
        : SUPPLIER_TRUST_TIER_META[tier].shortEn

  if (!progress.next) {
    return locale === "fr"
      ? `${currentLabel} · palier max atteint`
      : `${currentLabel} · top tier unlocked`
  }

  const nextMeta = SUPPLIER_TRUST_TIER_META[progress.next]
  const nextLabel = locale === "fr" ? nextMeta.shortFr : nextMeta.shortEn
  const orders = `${formatTrustOrderCount(progress.ordersProgress, locale)}/${formatTrustOrderCount(progress.ordersTarget, locale)}`

  return locale === "fr"
    ? `${currentLabel} · ${orders} commandes · Prochain : ${nextLabel}`
    : `${currentLabel} · ${orders} orders · Next: ${nextLabel}`
}

export function SupplierTrustLadderCard({ tier, metrics, locale = "fr", className }: Props) {
  const [open, setOpen] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const panelId = useId()
  const progress = buildTrustTierProgress(metrics, tier)
  const nextMeta = progress.next ? SUPPLIER_TRUST_TIER_META[progress.next] : null
  const collapsedSummary = buildCollapsedSummary(locale, tier, progress)

  useEffect(() => {
    setOpen(readPersistedOpen())
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0")
    } catch {
      // ignore quota / private mode
    }
  }, [open])

  const title = locale === "fr" ? "Badges fournisseur" : "Supplier badges"
  const subtitle =
    locale === "fr"
      ? "Trois niveaux de confiance — Spark, Forge, puis le badge bleu Orbital à 1 M+ commandes réussies."
      : "Three trust levels — Spark, Forge, then the blue Orbital badge at 1M+ successful orders."
  const toggleLabel = open
    ? locale === "fr"
      ? "Replier les badges fournisseur"
      : "Collapse supplier badges"
    : locale === "fr"
      ? "Déplier les badges fournisseur"
      : "Expand supplier badges"

  return (
    <section
      className={cn(missionControlAffisellCard, open ? "p-6" : "p-4 sm:p-5", className)}
      aria-labelledby="supplier-trust-ladder-title"
    >
      <div className={missionControlAffisellOverlayViolet} aria-hidden />
      <div className={missionControlAffisellOverlayIndigo} aria-hidden />
      <div className={missionControlAffisellScanline} aria-hidden />

      <div className="relative z-[1]">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-4 text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={toggleLabel}
        >
          <div className="min-w-0 flex-1">
            <p className={missionControlAffisellEyebrow}>Affisell Trust Ladder</p>
            <h2 id="supplier-trust-ladder-title" className={cn("mt-1 text-base tracking-tight sm:text-lg", missionControlHeading)}>
              {title}
            </h2>
            {open ? (
              <p className={cn("mt-1 max-w-lg", missionControlAffisellSubtext)}>{subtitle}</p>
            ) : (
              <p className={cn("mt-1.5 truncate", missionControlAffisellMuted)}>{collapsedSummary}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {tier !== "NONE" ? (
              <SupplierTrustBadge tier={tier} locale={locale} size="lg" className="hidden sm:flex" />
            ) : null}
            <span
              className={cn(
                missionControlAffisellToggle,
                "transition duration-300",
                open &&
                  "border-brand/30 bg-brand-muted/50 shadow-[0_0_12px_rgb(109_40_217/0.12)] dark:border-brand-light/25 dark:bg-brand-muted/35 dark:shadow-[0_0_12px_rgb(109_40_217/0.15)]"
              )}
            >
              <ChevronDown
                className={cn(
                  "size-4 text-brand dark:text-brand-light",
                  !reduceMotion && "transition-transform duration-300 ease-out",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </span>
          </div>
        </button>

        <div
          id={panelId}
          className={cn(
            "grid",
            !reduceMotion && "transition-[grid-template-rows,opacity] duration-300 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            {tier !== "NONE" ? (
              <div className="mt-4 sm:hidden">
                <SupplierTrustBadge tier={tier} locale={locale} size="lg" />
              </div>
            ) : null}

            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {LADDER.map((step) => {
                const meta = SUPPLIER_TRUST_TIER_META[step]
                const active = tier === step
                const unlocked = trustTierRank(tier) >= trustTierRank(step)
                const threshold = SUPPLIER_TRUST_THRESHOLDS[step]

                return (
                  <li
                    key={step}
                    className={cn("rounded-2xl border p-4 transition", ladderStepClass(step, active, unlocked))}
                  >
                    <div className="flex items-center gap-2">
                      {step === "ORBITAL" ? (
                        <OrbitalTrustIcon className="size-8" />
                      ) : (
                        <SupplierTrustBadge tier={step} locale={locale} size="icon" showLabel={false} />
                      )}
                      <div>
                        <p className="text-xs font-bold">{locale === "fr" ? meta.labelFr : meta.labelEn}</p>
                        <p className={missionControlAffisellMuted}>
                          {formatTrustOrderCount(threshold.minOrders, locale)}+ · ★{threshold.minRating}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            {progress.next && nextMeta ? (
              <div className={cn("mt-6", missionControlAffisellInnerPanel)}>
                <p className="text-sm font-semibold">
                  {locale === "fr" ? "Prochain palier" : "Next tier"} —{" "}
                  {locale === "fr" ? nextMeta.labelFr : nextMeta.labelEn}
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className={cn("mb-1 flex justify-between text-xs", missionControlAffisellSubtext)}>
                      <span>{locale === "fr" ? "Commandes réussies" : "Successful orders"}</span>
                      <span>
                        {formatTrustOrderCount(progress.ordersProgress, locale)} /{" "}
                        {formatTrustOrderCount(progress.ordersTarget, locale)}
                      </span>
                    </div>
                    <div className={cn("h-2 overflow-hidden rounded-full", missionControlProgressTrack)}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400"
                        style={{ width: `${pct(progress.ordersProgress, progress.ordersTarget)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className={cn("mb-1 flex justify-between text-xs", missionControlAffisellSubtext)}>
                      <span>{locale === "fr" ? "Note moyenne (90 j)" : "Avg. rating (90d)"}</span>
                      <span>
                        {progress.ratingProgress.toFixed(2)} / {progress.ratingTarget.toFixed(1)}
                      </span>
                    </div>
                    <div className={cn("h-2 overflow-hidden rounded-full", missionControlProgressTrack)}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                        style={{ width: `${pct(progress.ratingProgress, progress.ratingTarget)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : tier === "ORBITAL" ? (
              <p className="mt-6 text-sm font-medium text-sky-700 dark:text-sky-200">
                {locale === "fr"
                  ? "Badge Orbital bleu débloqué — vous êtes au sommet de la Trust Ladder Affisell."
                  : "Blue Orbital badge unlocked — top of the Affisell Trust Ladder."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
