import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierOnboardingCsvWizard } from "@/components/supplier/supplier-onboarding-csv-wizard"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierDashboardOnboardingPage() {
  const session = await requireSupplierSession("/dashboard/supplier/onboarding")

  const [user, affiliateCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeOnboardedAt: true, stripeAccountId: true },
    }),
    prisma.user.count({ where: { role: "AFFILIATE" } }),
  ])

  if (!user?.stripeAccountId) {
    redirect("/dashboard/supplier/settings/payouts")
  }

  return (
    <BentoShell className="bg-zinc-50/50 dark:bg-zinc-950">
      <BentoContainer maxWidth="4xl">
        <SupplierOnboardingCsvWizard
          kycReady={Boolean(user.stripeOnboardedAt)}
          affiliateCount={affiliateCount}
        />
      </BentoContainer>
    </BentoShell>
  )
}
