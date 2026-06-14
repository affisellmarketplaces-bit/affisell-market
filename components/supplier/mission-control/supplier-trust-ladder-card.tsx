"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useId, useState } from "react"

import { cn } from "@/lib/utils"
import {
  buildTrustTierProgress,
  formatTrustOrderCount,
  SUPPLIER_TRUST_TIER_META,
  SUPPLIER_TRUST_THRESHOLDS,
  trustTierRank,
  type SupplierTrustMetrics,
  type SupplierTrustTier,
} from "@/lib/supplier/supplier-trust-tier-shared"
import { OrbitalTrustIcon, SupplierTrustBadge } from "@/components/suppliers/supplier-trust-badge"

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
      return "border-amber-400/50 bg-amber-500/10 ring-1 ring-amber-400/35"
    }
    if (step === "FORGE") {
      return "border-violet-400/50 bg-violet-500/10 ring-1 ring-violet-400/35"
    }
    return "border-indigo-400/50 bg-indigo-500/10 ring-1 ring-indigo-400/35"
  }
  if (unlocked) {
    return "border-emerald-500/30 bg-emerald-500/5"
  }
  return "border-white/10 bg-white/5 opacity-80"
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
      ? "Trois niveaux de confiance — Spark, Forge, puis le badge Orbital à 1 M+ commandes réussies."
      : "Three trust levels — Spark, Forge, then the Orbital badge at 1M+ successful orders."
  const toggleLabel = open
    ? locale === "fr"
      ? "Replier les badges fournisseur"
      : "Collapse supplier badges"
    : locale === "fr"
      ? "Déplier les badges fournisseur"
      : "Expand supplier badges"

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/95 text-white shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm",
        open ? "p-6" : "p-4 sm:p-5",
        className
      )}
      aria-labelledby="supplier-trust-ladder-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_100%_0%,rgba(139,92,246,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-indigo-500/[0.04]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />

      <div className="relative">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left transition-colors hover:text-white/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={toggleLabel}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Affisell Trust Ladder
          </p>
          <h2 id="supplier-trust-ladder-title" className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h2>
          {open ? (
            <p className="mt-1 max-w-lg text-sm text-zinc-300">{subtitle}</p>
          ) : (
            <p className="mt-1.5 truncate text-xs font-medium text-zinc-400">{collapsedSummary}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {tier !== "NONE" ? (
            <SupplierTrustBadge tier={tier} locale={locale} size="lg" className="hidden sm:flex" />
          ) : null}
          <span
            className={cn(
              "relative flex size-9 items-center justify-center rounded-full",
              "border border-white/10 bg-white/5 backdrop-blur-md",
              "shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition duration-300",
              open && "border-violet-400/30 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.18)]"
            )}
          >
            <ChevronDown
              className={cn(
                "size-4 text-violet-200",
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
                  className={cn(
                    "rounded-2xl border p-4 transition",
                    ladderStepClass(step, active, unlocked)
                  )}
                >
                  <div className="flex items-center gap-2">
                    {step === "ORBITAL" ? (
                      <OrbitalTrustIcon className="size-8" />
                    ) : (
                      <SupplierTrustBadge tier={step} locale={locale} size="icon" showLabel={false} />
                    )}
                    <div>
                      <p className="text-xs font-bold">{locale === "fr" ? meta.labelFr : meta.labelEn}</p>
                      <p className="text-[10px] text-zinc-400">
                        {formatTrustOrderCount(threshold.minOrders, locale)}+ · ★{threshold.minRating}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          {progress.next && nextMeta ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold">
                {locale === "fr" ? "Prochain palier" : "Next tier"} —{" "}
                {locale === "fr" ? nextMeta.labelFr : nextMeta.labelEn}
              </p>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-zinc-300">
                    <span>{locale === "fr" ? "Commandes réussies" : "Successful orders"}</span>
                    <span>
                      {formatTrustOrderCount(progress.ordersProgress, locale)} /{" "}
                      {formatTrustOrderCount(progress.ordersTarget, locale)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-400"
                      style={{ width: `${pct(progress.ordersProgress, progress.ordersTarget)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-zinc-300">
                    <span>{locale === "fr" ? "Note moyenne (90 j)" : "Avg. rating (90d)"}</span>
                    <span>
                      {progress.ratingProgress.toFixed(2)} / {progress.ratingTarget.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                      style={{ width: `${pct(progress.ratingProgress, progress.ratingTarget)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : tier === "ORBITAL" ? (
            <p className="mt-6 text-sm font-medium text-violet-200">
              {locale === "fr"
                ? "Badge Orbital débloqué — vous êtes au sommet de la Trust Ladder Affisell."
                : "Orbital badge unlocked — top of the Affisell Trust Ladder."}
            </p>
          ) : null}
        </div>
      </div>
      </div>
    </section>
  )
}
