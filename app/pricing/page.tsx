import type { Metadata } from "next"

import { AffisellGrowthPricing } from "@/components/pricing/affisell-growth-pricing"
import PricingPageClient from "@/components/pricing/pricing-page-client"
import { PricingUpgradeToast } from "@/components/pricing/pricing-upgrade-toast"
import { auth } from "@/lib/auth"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Pricing — Affisell",
  description:
    "Lanceur, Dominator, Empire — plans Affisell pour resellers, stockeurs et marques. Radar Pro & Global.",
}

type SearchParams = Promise<{
  feature?: string | string[]
  plan?: string | string[]
  kind?: string | string[]
  upgrade?: string | string[]
  session_id?: string | string[]
}>

function first(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v
  if (Array.isArray(v) && typeof v[0] === "string") return v[0]
  return null
}

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const feature = first(sp.feature)
  const upgrade = first(sp.upgrade)
  const sessionId = first(sp.session_id)
  const kindRaw = first(sp.kind)
  const kindHint = kindRaw === "producer" || kindRaw === "stocker" ? kindRaw : null

  const session = await auth()
  let currentRadarPlan = "free"
  let currentSupplierKind: string | null = null
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true, radarPlan: true, email: true, supplierKind: true },
    })
    const plan = getUserRadarPlan({
      id: session.user.id,
      email: user?.email ?? session.user.email,
      isPro: user?.isPro ?? session.user.isPro,
      features: session.user.features,
      subscriptionTiers: user?.radarPlan ? [user.radarPlan] : [],
    })
    currentRadarPlan = plan.id
    currentSupplierKind = user?.supplierKind ?? null
  }

  const radarFocus = feature === "radar"

  return (
    <>
      <PricingUpgradeToast upgrade={upgrade ?? undefined} sessionId={sessionId ?? undefined} />
      {!radarFocus ? (
        <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#7C3AED] uppercase">
              Affisell Pricing
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Choisis ton arme de croissance
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
              Reseller, Stockeur ou Marque — un plan clair, conversion max, zéro friction.
            </p>
          </div>
          <div className="mt-10">
            <AffisellGrowthPricing kindHint={kindHint} />
          </div>
          <p className="mt-10 text-center text-sm text-zinc-500">
            Déjà sur Affisell Radar ?{" "}
            <a href="/pricing?feature=radar" className="font-medium text-[#7C3AED] hover:underline">
              Voir les plans Radar Pro / Global →
            </a>
          </p>
        </main>
      ) : (
        <PricingPageClient
          highlightFeature={feature}
          currentRadarPlan={currentRadarPlan}
          isAuthenticated={Boolean(session?.user?.id)}
          kindHint={kindHint}
          currentSupplierKind={currentSupplierKind}
        />
      )}
    </>
  )
}
