import type { Metadata } from "next"

import PricingPageClient from "@/components/pricing/pricing-page-client"
import { PricingUpgradeToast } from "@/components/pricing/pricing-upgrade-toast"
import { auth } from "@/lib/auth"
import { getUserRadarPlan } from "@/lib/radar/plans"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Pricing — Affisell",
  description: "Plans Affisell Radar Pro et Global — crawl mondial, winners, alertes Slack.",
}

type SearchParams = Promise<{
  feature?: string | string[]
  plan?: string | string[]
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

  const session = await auth()
  let currentRadarPlan = "free"
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true, radarPlan: true, email: true },
    })
    const plan = getUserRadarPlan({
      id: session.user.id,
      email: user?.email ?? session.user.email,
      isPro: user?.isPro ?? session.user.isPro,
      features: session.user.features,
      subscriptionTiers: user?.radarPlan ? [user.radarPlan] : [],
    })
    currentRadarPlan = plan.id
  }

  return (
    <>
      <PricingUpgradeToast upgrade={upgrade ?? undefined} sessionId={sessionId ?? undefined} />
      <PricingPageClient
        highlightFeature={feature}
        currentRadarPlan={currentRadarPlan}
        isAuthenticated={Boolean(session?.user?.id)}
      />
    </>
  )
}
