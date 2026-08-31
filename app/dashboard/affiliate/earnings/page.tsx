import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PartnerTaxCompliancePanel } from "@/components/affiliate/partner-tax-compliance-panel"
import { PayoutPolicyDisclaimer } from "@/components/merchant/payout-policy-disclaimer"
import { AffiliateMarginBulkFixCard } from "@/components/affiliate/affiliate-margin-bulk-fix-card"
import { AffiliatePushNotificationsCard } from "@/components/affiliate/affiliate-push-notifications-card"
import { AffiliateVariantMarginAnalyticsPanel } from "@/components/affiliate/affiliate-variant-margin-analytics-panel"
import { MerchantPulseHub } from "@/components/merchant/merchant-pulse-hub"
import { MerchantStripeConnectPanel } from "@/components/merchant/merchant-stripe-connect-panel"
import { buttonVariants } from "@/components/ui/button"
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
import { AFFILIATE_PAYOUT_SETTINGS_HREF } from "@/lib/affiliate-onboarding-shared"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AffiliateEarningsPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/earnings")
  const t = await getTranslations("affiliate.earnings.cockpit")
  const tPayouts = await getTranslations("affiliate.settings.payouts")

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
      <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{tPayouts("earningsCardTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {tPayouts("earningsCardBody")}
        </p>
        <Link
          href={AFFILIATE_PAYOUT_SETTINGS_HREF}
          className={cn(buttonVariants({ size: "sm" }), "mt-3 gap-1.5 bg-violet-600 text-white hover:bg-violet-700")}
        >
          {tPayouts("earningsCardCta")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <Suspense fallback={null}>
        <MerchantStripeConnectPanel
          role="AFFILIATE"
          connectOnboarded={Boolean(merchantUser?.stripeOnboardedAt)}
          stripeAccountId={merchantUser?.stripeAccountId ?? null}
          verificationApproved={kycProfile?.verificationStatus === "APPROVED"}
          syncRedirectPath={AFFILIATE_PAYOUT_SETTINGS_HREF}
          showUpdateWhenOnboarded
        />
      </Suspense>
      <Suspense fallback={null}>
        <AffiliatePushNotificationsCard />
      </Suspense>
      <PartnerTaxCompliancePanel />
      <PayoutPolicyDisclaimer role="AFFILIATE" />
    </div>
  )

  return (
    <MerchantPulseHub
      role="AFFILIATE"
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      paidOutLabel={t("paidOutLabel")}
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
