"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  BellRing,
  Check,
  Globe2,
  Radio,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { track } from "@/lib/analytics"
import type { RadarCheckoutPlanId } from "@/lib/radar/plans"
import { RADAR_PLANS } from "@/lib/radar/plans"
import {
  buildRadarPricingCards,
  RADAR_PRICING_PROOF,
  RADAR_PRICING_TRUST,
} from "@/lib/radar/pricing-copy"
import { formatRadarPlanPrice } from "@/lib/radar/pricing-display"
import { cn } from "@/lib/utils"

type Props = {
  highlightFeature: string | null
  currentRadarPlan: string
  isAuthenticated: boolean
  kindHint?: "producer" | "stocker" | null
  currentSupplierKind?: string | null
}

const RADAR_CARDS = buildRadarPricingCards()

function redirectBrowserTo(url: string) {
  window.location.assign(url)
}

export default function PricingPageClient({
  highlightFeature,
  currentRadarPlan,
  isAuthenticated,
  kindHint = null,
  currentSupplierKind = null,
}: Props) {
  const { status } = useSession()
  const [loadingPlan, setLoadingPlan] = useState<RadarCheckoutPlanId | null>(null)
  const radarFocus = highlightFeature === "radar"

  function trackPricingCta(plan: "pro" | "global" | "starter") {
    track("pricing_cta_clicked", {
      plan,
      kind_hint: kindHint,
      location: "radar_pricing_section",
      current_supplier_kind: currentSupplierKind ?? null,
    })
  }

  async function startCheckout(plan: RadarCheckoutPlanId) {
    trackPricingCta(plan)
    if (status !== "authenticated" && !isAuthenticated) {
      redirectBrowserTo(`/login?callbackUrl=${encodeURIComponent(`/pricing?feature=radar&plan=${plan}`)}`)
      return
    }

    setLoadingPlan(plan)
    try {
      const res = await fetch("/api/stripe/create-radar-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnPath: "/pricing?feature=radar" }),
      })
      const data = (await res.json()) as { url?: string; error?: string; message?: string }
      if (res.status === 503 && data.error === "STRIPE_GLOBAL_NOT_CONFIGURED") {
        toast.error("Plan Global non configuré - voir docs/STRIPE_RADAR_SETUP.md")
        setLoadingPlan(null)
        return
      }
      if (res.status === 503 && data.error === "STRIPE_PRO_NOT_CONFIGURED") {
        toast.error("Plan Pro non configuré - lance npm run stripe:ensure-radar")
        setLoadingPlan(null)
        return
      }
      if (!res.ok || !data.url) {
        throw new Error(data.message ?? data.error ?? "Impossible de démarrer le paiement")
      }
      redirectBrowserTo(data.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du checkout Radar")
      setLoadingPlan(null)
    }
  }

  return (
    <main className="relative mx-auto max-w-6xl overflow-hidden px-4 py-12 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.22),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] [background-size:48px_48px] mask-[linear-gradient(to_bottom,black,transparent)]"
      />

      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
          <Radio className="size-3.5" aria-hidden />
          Affisell Radar
        </p>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
          {radarFocus ? "Le signal avant le marché" : "Plans Affisell"}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          {radarFocus
            ? "Crawl mondial, winners <30j, map live, Slack à 3h — tu agis pendant que tes concurrents scrollent encore TikTok."
            : "Choisis le plan qui maximise ta conversion et ta LTV."}
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {RADAR_PRICING_TRUST.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-zinc-200/80 bg-white/70 px-3 py-3 text-center backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {item.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      <section
        id="radar"
        className={cn(
          "mt-12 rounded-[1.75rem] border p-5 sm:p-8",
          radarFocus
            ? "border-emerald-400/40 bg-gradient-to-b from-emerald-50/80 via-white to-white dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              Choisis ta couverture Radar
            </h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Plan actuel :{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {currentRadarPlan}
              </span>
              {" · "}
              chaque upgrade débloque immédiatement winners, map et alertes.
            </p>
          </div>
          <Link
            href="/radar"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <Globe2 className="size-4" aria-hidden />
            Ouvrir Radar →
          </Link>
        </div>

        <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
          {RADAR_CARDS.map((card) => {
            const plan = RADAR_PLANS[card.planId]
            const checkoutPlan = card.checkoutPlan
            const isCurrent = currentRadarPlan === plan.id
            const owned =
              currentRadarPlan === plan.id ||
              (plan.id === "pro" &&
                (currentRadarPlan === "pro" || currentRadarPlan === "global")) ||
              (plan.id === "global" && currentRadarPlan === "global")
            const featured = plan.id === "global"
            const popular = plan.id === "pro"

            return (
              <article
                key={plan.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl border p-5 transition duration-300",
                  featured
                    ? "border-emerald-400/70 bg-zinc-950 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_24px_60px_-28px_rgba(16,185,129,0.55)] lg:-translate-y-1"
                    : popular
                      ? "border-emerald-300/80 bg-white shadow-lg shadow-emerald-500/10 dark:border-emerald-800 dark:bg-zinc-950"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                )}
              >
                {featured ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.35),transparent_70%)]"
                  />
                ) : null}

                <div className="relative flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.18em]",
                        featured ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {card.eyebrow}
                    </p>
                    <h3
                      className={cn(
                        "mt-1 text-lg font-semibold",
                        featured ? "text-white" : "text-zinc-900 dark:text-white"
                      )}
                    >
                      {plan.name}
                    </h3>
                  </div>
                  {card.badge ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        featured
                          ? "bg-emerald-400 text-zinc-950"
                          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
                      )}
                    >
                      {featured ? <Sparkles className="size-3" aria-hidden /> : null}
                      {card.badge}
                    </span>
                  ) : null}
                </div>

                <div className="relative mt-4 flex items-end gap-1">
                  <p
                    className={cn(
                      "text-4xl font-semibold tracking-tight",
                      featured ? "text-white" : "text-zinc-900 dark:text-white"
                    )}
                  >
                    {plan.price === 0 ? "Gratuit" : formatRadarPlanPrice(plan.id, { includeSuffix: false })}
                  </p>
                  {plan.price > 0 ? (
                    <span
                      className={cn(
                        "mb-1 text-xs",
                        featured ? "text-zinc-400" : "text-zinc-500"
                      )}
                    >
                      /mois · HT
                    </span>
                  ) : null}
                </div>

                <p
                  className={cn(
                    "relative mt-3 text-sm leading-relaxed",
                    featured ? "text-zinc-300" : "text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {card.blurb}
                </p>
                <p
                  className={cn(
                    "relative mt-2 inline-flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium",
                    featured
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  )}
                >
                  <Zap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {card.outcome}
                </p>

                <ul className="relative mt-5 flex-1 space-y-3">
                  {card.features.map((f) => (
                    <li key={f.label} className="flex gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                          f.included
                            ? featured
                              ? "bg-emerald-400/20 text-emerald-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : featured
                              ? "bg-zinc-800 text-zinc-500"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
                        )}
                      >
                        {f.included ? (
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        ) : (
                          <span className="text-[10px] font-bold" aria-hidden>
                            —
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-sm font-medium leading-snug",
                            f.included
                              ? featured
                                ? "text-zinc-100"
                                : "text-zinc-800 dark:text-zinc-100"
                              : featured
                                ? "text-zinc-500"
                                : "text-zinc-400 dark:text-zinc-500",
                            f.highlight && f.included && "text-emerald-600 dark:text-emerald-300",
                            f.highlight && f.included && featured && "text-emerald-300"
                          )}
                        >
                          {f.label}
                        </span>
                        {f.detail ? (
                          <span
                            className={cn(
                              "mt-0.5 block text-[11px] leading-snug",
                              featured ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-500"
                            )}
                          >
                            {f.detail}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                {checkoutPlan ? (
                  <button
                    type="button"
                    disabled={owned || loadingPlan !== null}
                    onClick={() => void startCheckout(checkoutPlan)}
                    className={cn(
                      "relative mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50",
                      featured
                        ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                        : popular
                          ? "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    )}
                  >
                    {owned ? (
                      "Plan actif"
                    ) : loadingPlan === checkoutPlan ? (
                      "Redirection…"
                    ) : (
                      <>
                        {featured ? <BellRing className="size-4" aria-hidden /> : null}
                        Activer {plan.name}
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={isAuthenticated ? "/radar" : "/signup"}
                    onClick={() => trackPricingCta("starter")}
                    className={cn(
                      "relative mt-6 inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition",
                      featured
                        ? "border-zinc-600 text-zinc-100 hover:bg-zinc-900"
                        : "border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    )}
                  >
                    {isAuthenticated ? "Continuer gratuit" : "Créer un compte"}
                  </Link>
                )}

                {card.ctaHint && !owned ? (
                  <p
                    className={cn(
                      "relative mt-2 text-center text-[11px]",
                      featured ? "text-zinc-500" : "text-zinc-500"
                    )}
                  >
                    {card.ctaHint}
                  </p>
                ) : null}
                {isCurrent ? (
                  <p className="relative mt-2 text-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Votre plan actuel
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>

        <ul className="mt-8 grid gap-2 sm:grid-cols-3">
          {RADAR_PRICING_PROOF.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400"
            >
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Video Pro</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Générations vidéo illimitées pour fournisseurs — disponible depuis le dashboard produit.
        </p>
        <Link
          href="/dashboard/supplier"
          className="mt-4 inline-flex text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
        >
          Ouvrir le dashboard fournisseur →
        </Link>
      </section>
    </main>
  )
}
