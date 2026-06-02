"use client"

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

type Props = {
  tier: SupplierTrustTier
  metrics: SupplierTrustMetrics
  locale?: "fr" | "en"
  className?: string
}

const LADDER: Exclude<SupplierTrustTier, "NONE">[] = ["SPARK", "FORGE", "ORBITAL"]

function pct(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

export function SupplierTrustLadderCard({ tier, metrics, locale = "fr", className }: Props) {
  const progress = buildTrustTierProgress(metrics, tier)
  const nextMeta = progress.next ? SUPPLIER_TRUST_TIER_META[progress.next] : null

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-zinc-950 via-indigo-950 to-violet-950 p-6 text-white shadow-xl shadow-violet-900/20",
        className
      )}
      aria-labelledby="supplier-trust-ladder-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">Affisell Trust Ladder</p>
          <h2 id="supplier-trust-ladder-title" className="mt-1 text-xl font-bold tracking-tight">
            {locale === "fr" ? "Badges fournisseur" : "Supplier badges"}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-violet-100/80">
            {locale === "fr"
              ? "Trois niveaux de confiance — Spark, Forge, puis le badge bleu Orbital à 1 M+ commandes réussies."
              : "Three trust levels — Spark, Forge, then the blue Orbital badge at 1M+ successful orders."}
          </p>
        </div>
        {tier !== "NONE" ? (
          <SupplierTrustBadge tier={tier} locale={locale} size="lg" />
        ) : null}
      </div>

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
                active
                  ? "border-sky-400/60 bg-sky-500/10 ring-1 ring-sky-400/40"
                  : unlocked
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-white/10 bg-white/5 opacity-80"
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
                  <p className="text-[10px] text-violet-200/70">
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
              <div className="mb-1 flex justify-between text-xs text-violet-100/80">
                <span>{locale === "fr" ? "Commandes réussies" : "Successful orders"}</span>
                <span>
                  {formatTrustOrderCount(progress.ordersProgress, locale)} /{" "}
                  {formatTrustOrderCount(progress.ordersTarget, locale)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400"
                  style={{ width: `${pct(progress.ordersProgress, progress.ordersTarget)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-violet-100/80">
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
        <p className="mt-6 text-sm font-medium text-sky-200">
          {locale === "fr"
            ? "Badge Orbital bleu débloqué — vous êtes au sommet de la Trust Ladder Affisell."
            : "Orbital blue badge unlocked — top of the Affisell Trust Ladder."}
        </p>
      ) : null}
    </section>
  )
}
