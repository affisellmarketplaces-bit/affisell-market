import { requireAffiliateSession } from "@/lib/dashboard-session"
import { Suspense } from "react"

import { PartnerTaxCompliancePanel } from "@/components/affiliate/partner-tax-compliance-panel"
import { AffiliateMarginBulkFixCard } from "@/components/affiliate/affiliate-margin-bulk-fix-card"
import { AffiliatePushNotificationsCard } from "@/components/affiliate/affiliate-push-notifications-card"
import { AffiliateVariantMarginAnalyticsPanel } from "@/components/affiliate/affiliate-variant-margin-analytics-panel"
import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import { MerchantStripeConnectPanel } from "@/components/merchant/merchant-stripe-connect-panel"
import {
  emptyAffiliateEarningsPulse,
  loadAffiliateEarningsPulse,
} from "@/lib/merchant-earnings-pulse"
import {
  emptyAffiliateVariantMarginAnalytics,
  loadAffiliateVariantMarginAnalytics,
} from "@/lib/load-affiliate-variant-margin-analytics"
import { prisma } from "@/lib/prisma"
import { loadOrFallback } from "@/lib/safe-server-data"

export const dynamic = "force-dynamic"

export default async function AffiliateEarningsPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/earnings")

  const [data, marginAnalytics, marginReviewOpenCount, merchantUser, kycProfile] = await Promise.all([
    loadOrFallback(
      "affiliate/earnings",
      () => loadAffiliateEarningsPulse(session.user.id),
      emptyAffiliateEarningsPulse()
    ),
    loadOrFallback(
      "affiliate/earnings/variant-analytics",
      () => loadAffiliateVariantMarginAnalytics(session.user.id),
      emptyAffiliateVariantMarginAnalytics()
    ),
    prisma.affiliateProduct.count({
      where: {
        affiliateId: session.user.id,
        marginReviewNeeded: true,
        isListed: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeAccountId: true, stripeOnboardedAt: true },
    }),
    prisma.merchantLegalProfile.findUnique({
      where: { userId: session.user.id },
      select: { verificationStatus: true },
    }),
  ])

  const connectSlot = (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <MerchantStripeConnectPanel
          role="AFFILIATE"
          connectOnboarded={Boolean(merchantUser?.stripeOnboardedAt)}
          stripeAccountId={merchantUser?.stripeAccountId ?? null}
          verificationApproved={kycProfile?.verificationStatus === "APPROVED"}
        />
      </Suspense>
      <Suspense fallback={null}>
        <AffiliatePushNotificationsCard />
      </Suspense>
      <PartnerTaxCompliancePanel />
    </div>
  )

  return (
    <MerchantPulseHub
      role="AFFILIATE"
      eyebrow="Partner commerce"
      title="Earnings cockpit"
      description="Partner remuneration from supplier commission and your net markup on each sale, minus Affisell platform fee. You are a curator partner, not the product seller — declare earnings under your country of residence."
      paidOutLabel="Paid out via ledger"
      paidOutCents={data.paidOutCents}
      bands={data.bands}
      sparkline={data.sparkline}
      recentLedger={data.recentLedger}
      backHref="/dashboard/affiliate"
      leadingSlot={connectSlot}
      trailingSlot={
        <div className="space-y-4">
          <AffiliateMarginBulkFixCard openReviewCount={marginReviewOpenCount} />
          <AffiliateVariantMarginAnalyticsPanel data={marginAnalytics} />
        </div>
      }
    />
  )
}
