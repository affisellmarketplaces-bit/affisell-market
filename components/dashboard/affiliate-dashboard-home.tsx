import { Suspense } from "react"

import { AffiliateOnboardingChecklist } from "@/components/affiliate/affiliate-onboarding-checklist"
import { AffiliateKycPublishBanner } from "@/components/affiliate/affiliate-kyc-publish-banner"
import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { AffiliateAnalyticsWidget } from "@/components/dashboard/affiliate-analytics-widget"
import { ClawbackRiskWidget } from "@/components/dashboard/clawback-risk-widget"
import { loadAffiliateClawbackRisk } from "@/lib/affiliate-clawback-risk"
import { loadAffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadAffiliateFirstSaleProgress } from "@/lib/merchant-first-sale-progress"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"

import { AffiliateDashboard } from "@/app/dashboard/affiliate/affiliate-dashboard"

type Props = {
  callbackPath: string
}

export async function AffiliateDashboardHome({ callbackPath }: Props) {
  const session = await requireAffiliateSession(callbackPath)
  const [firstSaleProgress, kycGate, clawbackRisk, analytics] = await Promise.all([
    loadAffiliateFirstSaleProgress(session.user.id),
    merchantVerificationGate(session.user.id),
    loadAffiliateClawbackRisk(session.user.id),
    loadAffiliateDashboardAnalytics(session.user.id),
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
          <AffiliateAnalyticsWidget analytics={analytics} />
          <ClawbackRiskWidget riskCents={clawbackRisk.riskCents} />
        </BentoContainer>
        <AffiliateDashboard storeId={session.user.id} />
      </div>
    </Suspense>
  )
}
