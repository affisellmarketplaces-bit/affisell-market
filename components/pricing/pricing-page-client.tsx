"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import type { RadarCheckoutPlanId } from "@/lib/radar/plans"
import { RADAR_PLANS, type RadarPlan } from "@/lib/radar/plans"
import { cn } from "@/lib/utils"

type Props = {
  highlightFeature: string | null
  currentRadarPlan: string
  isAuthenticated: boolean
}

const RADAR_CARDS: Array<{
  plan: RadarPlan
  checkoutPlan: RadarCheckoutPlanId | null
  badge?: string
  blurb: string
}> = [
  {
    plan: RADAR_PLANS.starter,
    checkoutPlan: null,
    blurb: "1 shop connectée — idéal pour tester le crawl.",
  },
  {
    plan: RADAR_PLANS.pro,
    checkoutPlan: "pro",
    badge: "Populaire",
    blurb: "Winners live, map, 10 alertes — avant tes concurrents locaux.",
  },
  {
    plan: RADAR_PLANS.global,
    checkoutPlan: "global",
    badge: "Max LTV",
    blurb: "Crawl mondial + Slack 3h du mat — winners BR / US / SEA.",
  },
]

export default function PricingPageClient({
  highlightFeature,
  currentRadarPlan,
  isAuthenticated,
}: Props) {
  const { status } = useSession()
  const [loadingPlan, setLoadingPlan] = useState<RadarCheckoutPlanId | null>(null)
  const radarFocus = highlightFeature === "radar"

  async function startCheckout(plan: RadarCheckoutPlanId) {
    if (status !== "authenticated" && !isAuthenticated) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/pricing?feature=radar&plan=${plan}`)}`
      return
    }

    setLoadingPlan(plan)
    try {
      const res = await fetch("/api/stripe/create-radar-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnPath: "/pricing" }),
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
      window.location.href = data.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du checkout Radar")
      setLoadingPlan(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Affisell Pricing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          {radarFocus ? "Débloque Affisell Radar" : "Plans Affisell"}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          {radarFocus
            ? "Crawl mondial, winners <30j, alertes Slack — upgrade en 1 clic."
            : "Choisis le plan qui maximise ta conversion et ta LTV."}
        </p>
      </div>

      <section
        id="radar"
        className={cn(
          "mt-12 rounded-2xl border p-6 sm:p-8",
          radarFocus
            ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Affisell Radar</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Veille multi-marketplace + Google. Plan actuel :{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {currentRadarPlan}
              </span>
            </p>
          </div>
          <Link href="/radar" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            Ouvrir Radar →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {RADAR_CARDS.map(({ plan, checkoutPlan, badge, blurb }) => {
            const isCurrent = currentRadarPlan === plan.id
            const owned =
              currentRadarPlan === plan.id ||
              (plan.id === "pro" && (currentRadarPlan === "pro" || currentRadarPlan === "global")) ||
              (plan.id === "global" && currentRadarPlan === "global")

            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-white p-5 dark:bg-zinc-950",
                  plan.id === "global"
                    ? "border-emerald-400 shadow-sm dark:border-emerald-700"
                    : "border-zinc-200 dark:border-zinc-800"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{plan.name}</h3>
                  {badge ? (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-white">
                  {plan.price === 0 ? "Gratuit" : `$${plan.price}`}
                  {plan.price > 0 ? (
                    <span className="text-base font-normal text-zinc-500">/mois</span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{blurb}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>{plan.maxShops} shops</li>
                  <li>{plan.maxProducts.toLocaleString("fr-FR")} produits</li>
                  <li>{plan.maxAlerts} alertes</li>
                  <li>Map {plan.hasMap ? "✓" : "—"}</li>
                  <li>Slack {plan.hasSlack ? "✓" : "—"}</li>
                </ul>
                {checkoutPlan ? (
                  <button
                    type="button"
                    disabled={owned || loadingPlan !== null}
                    onClick={() => void startCheckout(checkoutPlan)}
                    className={cn(
                      "mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition",
                      plan.id === "global"
                        ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                        : "bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    )}
                  >
                    {owned
                      ? "Plan actif"
                      : loadingPlan === checkoutPlan
                        ? "Redirection…"
                        : `Activer ${plan.name}`}
                  </button>
                ) : (
                  <Link
                    href={isAuthenticated ? "/radar" : "/signup"}
                    className="mt-6 inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    {isAuthenticated ? "Continuer gratuit" : "Créer un compte"}
                  </Link>
                )}
                {isCurrent ? (
                  <p className="mt-2 text-center text-[11px] text-emerald-700 dark:text-emerald-400">
                    Votre plan actuel
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
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
