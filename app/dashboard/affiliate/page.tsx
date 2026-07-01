import { requireAffiliateSession } from "@/lib/dashboard-session"
import { Suspense } from "react"

import { AffiliateOnboardingChecklist } from "@/components/affiliate/affiliate-onboarding-checklist"
import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { loadAffiliateFirstSaleProgress } from "@/lib/merchant-first-sale-progress"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

/** No Prisma on SSR — hosted DB may block queries when transfer quota is exceeded. */
export default async function AffiliateDashboardPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate")
  const firstSaleProgress = await loadAffiliateFirstSaleProgress(session.user.id)

  return (
    <Suspense
      fallback={
        <BentoShell>
          <BentoContainer>
            <BentoCard className="py-12 text-center text-sm text-gray-600 dark:text-zinc-300">
              Loading your dashboard…
            </BentoCard>
          </BentoContainer>
        </BentoShell>
      }
    >
      <div className="space-y-6">
        <BentoContainer maxWidth="6xl" className="pt-8">
          <AffiliateOnboardingChecklist progress={firstSaleProgress} />
        </BentoContainer>
        <AffiliateDashboard storeId={session.user.id} />
      </div>
    </Suspense>
  )
}
