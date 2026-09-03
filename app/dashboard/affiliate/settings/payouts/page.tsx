import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, Wallet } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { AffiliateMultiPayoutSection } from "@/components/affiliate/affiliate-multi-payout-section"
import { AffiliatePayoutBankStatus } from "@/components/affiliate/affiliate-payout-bank-status"
import { AffiliatePayoutRailTimeline } from "@/components/affiliate/affiliate-payout-rail-timeline"
import { PartnerTaxCompliancePanel } from "@/components/affiliate/partner-tax-compliance-panel"
import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { MerchantStripeConnectPanel } from "@/components/merchant/merchant-stripe-connect-panel"
import { PayoutPolicyDisclaimer } from "@/components/merchant/payout-policy-disclaimer"
import { buttonVariants } from "@/components/ui/button"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { FLAGS } from "@/lib/flags"
import { prisma } from "@/lib/prisma"
import { loadStripeConnectStatusForUser } from "@/lib/stripe-connect-status.server"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AffiliatePayoutSettingsPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/settings/payouts")
  const t = await getTranslations("affiliate.settings.payouts")

  const [connectStatus, kycProfile] = await Promise.all([
    loadStripeConnectStatusForUser(session.user.id),
    prisma.merchantLegalProfile.findUnique({
      where: { userId: session.user.id },
      select: { verificationStatus: true },
    }),
  ])

  const kycApproved = kycProfile?.verificationStatus === "APPROVED"

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-6 py-10">
        <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-emerald-500/10 p-6 dark:border-violet-900/40 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(167,139,250,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.12),transparent_40%)]" />
          <div className="relative">
            <Link
              href="/dashboard/affiliate/earnings"
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              ← {t("backEarnings")}
            </Link>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-800 dark:text-violet-200">
              <Wallet className="size-3.5" aria-hidden />
              {t("badge")}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t("description")}
            </p>
          </div>
        </div>

        <AffiliatePayoutBankStatus
          initialTransfersActive={connectStatus.transfersActive}
          initialBankLast4={connectStatus.bankLast4}
          initialBankName={connectStatus.bankName}
        />

        <Suspense fallback={null}>
          <MerchantStripeConnectPanel
            role="AFFILIATE"
            connectOnboarded={connectStatus.transfersActive}
            stripeAccountId={connectStatus.accountId}
            verificationApproved={kycApproved}
            syncRedirectPath="/dashboard/affiliate/settings/payouts"
            showUpdateWhenOnboarded
          />
        </Suspense>

        {FLAGS.AFFILIATE_MULTI_PAYOUT ? (
          <Suspense fallback={null}>
            <AffiliateMultiPayoutSection affiliateId={session.user.id} />
          </Suspense>
        ) : null}

        <AffiliatePayoutRailTimeline />

        <PartnerTaxCompliancePanel />

        <PayoutPolicyDisclaimer role="AFFILIATE" />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("ledgerTeaserTitle")}</p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t("ledgerTeaserBody")}</p>
          </div>
          <Link
            href="/dashboard/affiliate/earnings"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5 bg-violet-600 text-white hover:bg-violet-700")}
          >
            {t("ledgerCta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
