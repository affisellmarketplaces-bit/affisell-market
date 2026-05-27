import { redirect } from "next/navigation"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { getLocale } from "next-intl/server"

import { BentoContainer } from "@/components/affisell/bento-ui"
import { SupplierGrowthSection } from "@/components/supplier/mission-control/supplier-growth-section"
import { SupplierMetricsBar } from "@/components/supplier/mission-control/supplier-metrics-bar"
import { SupplierWeeklyGoalCard } from "@/components/supplier/mission-control/supplier-weekly-goal-card"
import { SupplierInviteContextBanner } from "@/components/supplier/supplier-invite-context-banner"
import { SupplierMissionControlHeader } from "@/components/supplier/mission-control/supplier-mission-control-header"
import { SupplierMissionControlLive } from "@/components/supplier/mission-control/supplier-mission-control-live"
import { SupplierOnboardingChecklist } from "@/components/supplier/mission-control/supplier-onboarding-checklist"
import { SupplierToolsRow } from "@/components/supplier/mission-control/supplier-tools-row"
import { SupplierUrgentActions } from "@/components/supplier/mission-control/supplier-urgent-actions"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadSupplierMissionControl } from "@/lib/supplier-mission-control"

export const dynamic = "force-dynamic"

export default async function DashboardSupplierPage() {
  const session = await requireSupplierSession("/dashboard/supplier")


  let data: Awaited<ReturnType<typeof loadSupplierMissionControl>>
  try {
    data = await loadSupplierMissionControl(session.user.id)
  } catch (error) {
    console.error("[supplier/dashboard] mission control failed", error)
    return (
      <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/50 px-4 py-16 text-center dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Tableau de bord temporairement indisponible
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Réessayez dans quelques instants — la connexion base de données a échoué.
        </p>
      </main>
    )
  }

  const locale = resolveAppLocale(await getLocale())

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <BentoContainer maxWidth="6xl" className="space-y-8 py-8 sm:py-10">
        <SupplierMissionControlLive>
          <SupplierMissionControlHeader storeName={data.storeName} />
          <SupplierInviteContextBanner />

          {data.weeklyGoal && data.metrics7d.hasPriorPeriodData ? (
            <SupplierWeeklyGoalCard goal={data.weeklyGoal} locale={locale} />
          ) : null}

          {data.productCount === 0 ? (
            <SupplierOnboardingChecklist storeSlug={data.storeSlug} />
          ) : (
            <>
              <SupplierUrgentActions urgent={data.urgent} />
              <SupplierMetricsBar metrics={data.metrics7d} weeklyGoal={data.weeklyGoal} locale={locale} />
              <SupplierGrowthSection growth={data.growth} />
            </>
          )}

          <SupplierToolsRow />
        </SupplierMissionControlLive>
      </BentoContainer>
    </main>
  )
}
