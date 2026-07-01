import type { Metadata } from "next"
import { Suspense } from "react"

import { AffiliateFirstListingCoachBanner } from "@/components/affiliate/affiliate-first-listing-coach-banner"
import { AffiliateKycPublishBanner } from "@/components/affiliate/affiliate-kyc-publish-banner"
import { AffiliateSwipeFeed } from "@/components/affiliate/swipe-feed/affiliate-swipe-feed"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { isAffiliateOnboardingQuery } from "@/lib/affiliate-onboarding-shared"
import { loadAffiliateFirstSaleProgress } from "@/lib/merchant-first-sale-progress"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Hub Ambassadeur — Swipe Feed | Affisell",
  description: "Découvrez et listez des produits en mode Swipe Feed.",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AffiliateHubPage({ searchParams }: PageProps) {
  const session = await requireAffiliateSession("/dashboard/affiliate/hub")

  const sp = await searchParams
  const modeRaw = typeof sp.mode === "string" ? sp.mode : Array.isArray(sp.mode) ? sp.mode[0] : ""
  const initialMode = modeRaw === "swipe" ? "swipe" : "hub"
  const showFirstListingCoach = isAffiliateOnboardingQuery(sp.onboarding)

  const [gate, progress] = await Promise.all([
    merchantVerificationGate(session.user.id),
    loadAffiliateFirstSaleProgress(session.user.id),
  ])

  return (
    <div className="space-y-4">
      {(showFirstListingCoach || !progress.kycApproved) && (
        <div className="mx-auto max-w-3xl space-y-3 px-4 pt-4 sm:px-6">
          {showFirstListingCoach ? <AffiliateFirstListingCoachBanner /> : null}
          <AffiliateKycPublishBanner
            allowed={gate.allowed}
            reason={gate.reason ?? null}
            status={gate.status}
            draftCount={progress.draftListingCount}
            compact
          />
        </div>
      )}
      <Suspense
        fallback={
          <div className="flex min-h-[calc(100dvh-3.75rem)] items-center justify-center bg-zinc-950 text-zinc-500">
            Chargement du hub…
          </div>
        }
      >
        <AffiliateSwipeFeed
          initialMode={initialMode}
          listingContext={showFirstListingCoach ? "onboarding" : "swipe"}
        />
      </Suspense>
    </div>
  )
}
