import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { AffiliateBattleDiscountCard } from "@/components/affiliate/affiliate-battle-discount-card"
import { AffiliateFirstListingCoachBanner } from "@/components/affiliate/affiliate-first-listing-coach-banner"
import { AffiliateHubHashRedirect } from "@/components/affiliate/affiliate-hub-hash-redirect"
import { AffiliateHubLauncher } from "@/components/affiliate/affiliate-hub-launcher"
import { AffiliateActionPlanCard } from "@/components/affiliate/affiliate-action-plan-card"
import { AffiliateCopilotResultsCard } from "@/components/affiliate/affiliate-copilot-results-card"
import { AffiliateAutonomySettings } from "@/components/affiliate/affiliate-autonomy-settings"
import { AffiliateKycPublishBanner } from "@/components/affiliate/affiliate-kyc-publish-banner"
import { AffiliateOnboardingChecklist } from "@/components/affiliate/affiliate-onboarding-checklist"
import { AffiliateOpportunityPulseRail } from "@/components/affiliate/affiliate-opportunity-pulse-rail"
import { AffiliateSwipeFeed } from "@/components/affiliate/swipe-feed/affiliate-swipe-feed"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadAffiliateOpportunityPulsePicks } from "@/lib/affiliate-catalog-opportunity-pulse"
import { isAffiliateOnboardingQuery } from "@/lib/affiliate-onboarding-shared"
import { parseAffiliateHubMode } from "@/lib/affiliate-routes"
import { loadAffiliateFirstSaleProgress } from "@/lib/merchant-first-sale-progress"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { loadResellerActionPlan } from "@/lib/reseller-action-plan.server"
import { loadActionOutcomes, loadCopilotAccuracy } from "@/lib/copilot-insights.server"
import { listAutonomyRules, listRecentAutoActions } from "@/lib/copilot-autonomy.server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("affiliate.hub")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  }
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AffiliateHubPage({ searchParams }: PageProps) {
  const session = await requireAffiliateSession("/dashboard/affiliate/hub")

  const sp = await searchParams
  const modeRaw = typeof sp.mode === "string" ? sp.mode : Array.isArray(sp.mode) ? sp.mode[0] : ""
  const hubMode = parseAffiliateHubMode(modeRaw)
  const showFirstListingCoach = isAffiliateOnboardingQuery(sp.onboarding)

  const [gate, progress, opportunityPicks, actionPlan, accuracy, outcomes, autonomy, recentAuto] = await Promise.all([
    merchantVerificationGate(session.user.id),
    loadAffiliateFirstSaleProgress(session.user.id),
    loadAffiliateOpportunityPulsePicks(session.user.id, 3).catch((err) => {
      console.error("[affiliate/hub] opportunity pulse failed:", err)
      return []
    }),
    // What to fix, stop, reprice, push or list today (hub home only; never throws, estimates only).
    hubMode === "hub" ? loadResellerActionPlan(session.user.id) : Promise.resolve(null),
    // Is the copilot right for this reseller? (estimated vs due vs paid; before/after of applied actions)
    hubMode === "hub" ? loadCopilotAccuracy({ affiliateId: session.user.id }) : Promise.resolve(null),
    hubMode === "hub" ? loadActionOutcomes(session.user.id) : Promise.resolve(null),
    hubMode === "hub" ? listAutonomyRules(session.user.id) : Promise.resolve(null),
    // The copilot's own actions of the last 7 days, undoable here (the notification says « from your hub »).
    hubMode === "hub" ? listRecentAutoActions(session.user.id) : Promise.resolve([]),
  ])

  const showSwipeCoachBanner = hubMode === "swipe" || showFirstListingCoach
  const showTopRail =
    showSwipeCoachBanner || (!progress.kycApproved && progress.draftListingCount > 0)
  /** Opportunity rail only on Swipe (sourcing) — not on Battle setup. */
  const showOpportunityRail = hubMode === "swipe" && opportunityPicks.length > 0

  const tHub = await getTranslations("affiliate.hub")

  return (
    <div className="space-y-4">
      <AffiliateHubHashRedirect />
      {showTopRail ? (
        <div className="mx-auto max-w-3xl space-y-3 px-4 pt-4 sm:px-6">
          {showFirstListingCoach && progress.showChecklist ? (
            <AffiliateOnboardingChecklist progress={progress} />
          ) : null}
          {showSwipeCoachBanner ? (
            <AffiliateFirstListingCoachBanner force={showFirstListingCoach} />
          ) : null}
          {!progress.kycApproved && progress.draftListingCount > 0 ? (
            <AffiliateKycPublishBanner
              allowed={gate.allowed}
              reason={gate.reason ?? null}
              status={gate.status}
              draftCount={progress.draftListingCount}
              compact
            />
          ) : null}
        </div>
      ) : null}
      {showOpportunityRail ? (
        <div className="mx-auto max-w-3xl px-4 pt-2 sm:px-6">
          <AffiliateOpportunityPulseRail picks={opportunityPicks} compact />
        </div>
      ) : null}

      {hubMode === "battle" ? (
        <AffiliateBattleDiscountCard />
      ) : null}

      {hubMode === "hub" && actionPlan && actionPlan.actions.length > 0 ? (
        <div className="mx-auto max-w-3xl px-4 pt-2 sm:px-6">
          <AffiliateActionPlanCard actions={actionPlan.actions} />
        </div>
      ) : null}

      {hubMode === "hub" && accuracy && outcomes ? (
        <div className="mx-auto max-w-3xl px-4 pt-2 sm:px-6">
          <AffiliateCopilotResultsCard accuracy={accuracy.overall} outcomes={outcomes.outcomes} />
        </div>
      ) : null}

      {hubMode === "hub" && autonomy?.available ? (
        <div className="mx-auto max-w-3xl px-4 pt-2 sm:px-6">
          <AffiliateAutonomySettings rules={autonomy.rules} available={autonomy.available} recentAuto={recentAuto} />
        </div>
      ) : null}

      {hubMode === "hub" ? <AffiliateHubLauncher /> : null}

      {hubMode === "swipe" ? (
        <Suspense
          fallback={
            <div className="flex min-h-[calc(100dvh-3.75rem)] items-center justify-center bg-zinc-950 text-zinc-500">
              {tHub("hubLoading")}
            </div>
          }
        >
          <AffiliateSwipeFeed
            initialMode="swipe"
            listingContext={showFirstListingCoach ? "onboarding" : "swipe"}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
