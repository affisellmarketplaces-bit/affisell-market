import { getTranslations } from "next-intl/server"

import { ReferralStudio } from "@/components/affiliate/referral-studio"
import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadReferralDashboardStats } from "@/lib/referral"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function generateMetadata() {
  const t = await getTranslations("affiliate.referral")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function AffiliateReferralPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/referral")
  const stats = await loadReferralDashboardStats(session.user.id)

  const recentPayout = await prisma.merchantPayoutLedger.findFirst({
    where: {
      userId: session.user.id,
      beneficiaryRole: "AFFILIATE",
      entryType: "PAYOUT",
    },
    orderBy: { createdAt: "desc" },
    select: { amountCents: true },
  })

  const recentPayoutLabel = recentPayout
    ? formatStoreCurrencyFromCents(recentPayout.amountCents)
    : null

  return (
    <BentoShell className="bg-zinc-50/50 dark:bg-zinc-950">
      <BentoContainer maxWidth="4xl">
        <ReferralStudio
          stats={{
            ...stats,
            recentPayoutLabel,
          }}
        />
      </BentoContainer>
    </BentoShell>
  )
}
