import { requireAffiliateSession } from "@/lib/dashboard-session"
import { Suspense } from "react"

import { AffiliateOnboardingChecklist } from "@/components/affiliate/affiliate-onboarding-checklist"
import { AffiliateKycPublishBanner } from "@/components/affiliate/affiliate-kyc-publish-banner"
import { ClawbackRiskWidget } from "@/components/dashboard/clawback-risk-widget"
import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { loadAffiliateClawbackRisk } from "@/lib/affiliate-clawback-risk"
import { loadAffiliateFirstSaleProgress } from "@/lib/merchant-first-sale-progress"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

/** No Prisma on SSR — hosted DB may block queries when transfer quota is exceeded. */
export default async function AffiliateDashboardPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate")
  const [firstSaleProgress, kycGate, clawbackRisk] = await Promise.all([
    loadAffiliateFirstSaleProgress(session.user.id),
    merchantVerificationGate(session.user.id),
    loadAffiliateClawbackRisk(session.user.id),
  ])

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
        <BentoContainer maxWidth="6xl" className="space-y-4 pt-8">
          <AffiliateKycPublishBanner
            allowed={kycGate.allowed}
            reason={kycGate.reason ?? null}
            status={kycGate.status}
            draftCount={firstSaleProgress.draftListingCount}
          />
          <AffiliateOnboardingChecklist progress={firstSaleProgress} />
          <ClawbackRiskWidget
            riskCents={clawbackRisk.riskCents}
            pendingReturnCount={clawbackRisk.pendingReturnCount}
          />
        </BentoContainer>
        <AffiliateDashboard storeId={session.user.id} />
      </div>
    </Suspense>
  )
}
