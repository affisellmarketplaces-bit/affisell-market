import { redirect } from "next/navigation"

import { BentoContainer } from "@/components/affisell/bento-ui"
import { SupplierGrowthSection } from "@/components/supplier/mission-control/supplier-growth-section"
import { SupplierMetricsBar } from "@/components/supplier/mission-control/supplier-metrics-bar"
import { SupplierWeeklyGoalCard } from "@/components/supplier/mission-control/supplier-weekly-goal-card"
import { SupplierMissionControlHeader } from "@/components/supplier/mission-control/supplier-mission-control-header"
import { SupplierMissionControlLive } from "@/components/supplier/mission-control/supplier-mission-control-live"
import { SupplierOnboardingChecklist } from "@/components/supplier/mission-control/supplier-onboarding-checklist"
import { SupplierToolsRow } from "@/components/supplier/mission-control/supplier-tools-row"
import { SupplierUrgentActions } from "@/components/supplier/mission-control/supplier-urgent-actions"
import { auth } from "@/auth"
import { loadSupplierMissionControl } from "@/lib/supplier-mission-control"

export const dynamic = "force-dynamic"

export default async function DashboardSupplierPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }

  const data = await loadSupplierMissionControl(session.user.id)

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <BentoContainer maxWidth="6xl" className="space-y-8 py-8 sm:py-10">
        <SupplierMissionControlLive>
          <SupplierMissionControlHeader storeName={data.storeName} />

          {data.weeklyGoal ? <SupplierWeeklyGoalCard goal={data.weeklyGoal} /> : null}

          {data.productCount === 0 ? (
            <SupplierOnboardingChecklist storeSlug={data.storeSlug} />
          ) : (
            <>
              <SupplierUrgentActions urgent={data.urgent} storeSlug={data.storeSlug} />
              <SupplierMetricsBar metrics={data.metrics7d} />
              <SupplierGrowthSection growth={data.growth} />
            </>
          )}

          <SupplierToolsRow />
        </SupplierMissionControlLive>
      </BentoContainer>
    </main>
  )
}
