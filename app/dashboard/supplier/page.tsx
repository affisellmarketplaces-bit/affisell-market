import { requireSupplierSession } from "@/lib/dashboard-session"
import { ChevronDown } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import { BentoContainer } from "@/components/affisell/bento-ui"
import { SupplierAnalyticsWidget } from "@/components/dashboard/supplier-analytics-widget"
import { missionControlCanvas } from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { SupplierFeeGridCard } from "@/components/supplier/supplier-fee-grid-card"
import { SupplierEscrowPulseCard } from "@/components/supplier/mission-control/supplier-escrow-pulse-card"
import { SupplierGrowthSection } from "@/components/supplier/mission-control/supplier-growth-section"
import { prisma } from "@/lib/prisma"
import { SupplierMetricsBar } from "@/components/supplier/mission-control/supplier-metrics-bar"
import { SupplierWeeklyGoalCard } from "@/components/supplier/mission-control/supplier-weekly-goal-card"
import { SupplierInviteContextBanner } from "@/components/supplier/supplier-invite-context-banner"
import { SupplierKpiStrip } from "@/components/supplier/mission-control/supplier-kpi-strip"
import { SupplierMissionControlHeader } from "@/components/supplier/mission-control/supplier-mission-control-header"
import { SupplierMissionControlLive } from "@/components/supplier/mission-control/supplier-mission-control-live"
import { SupplierOnboardingChecklist } from "@/components/supplier/mission-control/supplier-onboarding-checklist"
import { SupplierToolsRow } from "@/components/supplier/mission-control/supplier-tools-row"
import { SupplierTrustLadderCard } from "@/components/supplier/mission-control/supplier-trust-ladder-card"
import { SupplierUrgentActions } from "@/components/supplier/mission-control/supplier-urgent-actions"
import { loadSupplierTrustSnapshot } from "@/lib/supplier/compute-supplier-trust-tier"
import { coerceSupplierTrustTier } from "@/lib/supplier/supplier-trust-tier-shared"
import { loadSupplierPublishReadiness } from "@/lib/supplier-publish-readiness"
import { loadSupplierFirstSaleProgress } from "@/lib/merchant-first-sale-progress"
import { loadSupplierMissionControl } from "@/lib/supplier-mission-control"
import { getSupplierAnalytics } from "@/lib/supplier-dashboard-analytics"
import { SupplierKycPublishBanner } from "@/components/supplier/supplier-kyc-publish-banner"
import { SupplierPublishReadinessCard } from "@/components/supplier/mission-control/supplier-publish-readiness-card"
import { countResellersListingSupplier } from "@/lib/radar/supplier-reach.server"
import { RadarSupplierDiscoveryCard } from "@/components/radar/radar-discovery-card"
import { SupplierProductRequestsTeaser } from "@/components/requests/SupplierProductRequestsTeaser"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"

export const dynamic = "force-dynamic"

export default async function DashboardSupplierPage() {
  const session = await requireSupplierSession("/dashboard/supplier")


  let data: Awaited<ReturnType<typeof loadSupplierMissionControl>>
  try {
    data = await loadSupplierMissionControl(session.user.id)
  } catch (error) {
    console.error("[supplier/dashboard] mission control failed", error)
    const tErr = await getTranslations("supplierDashboard.unavailable")
    return (
      <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/50 px-4 py-16 text-center dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{tErr("title")}</p>
        <p className="mt-2 text-sm text-zinc-500">{tErr("body")}</p>
      </main>
    )
  }

  const tMore = await getTranslations("supplierDashboard.more")
  const locale = resolveAppLocale(await getLocale())
  const copyLocale = resolveBinaryCopyLocale(locale)

  const [feeUser, trustSnapshot, publishReadiness, firstSaleProgress, analytics] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        supplierFeeBps: true,
        supplierFeeBpsCatalog: true,
        supplierFeeBpsAutoBuy: true,
        supplierTrustTier: true,
        supplierKind: true,
      },
    }),
    loadSupplierTrustSnapshot(session.user.id),
    loadSupplierPublishReadiness(session.user.id),
    loadSupplierFirstSaleProgress(session.user.id, data.storeSlug),
    getSupplierAnalytics(session.user.id),
  ])

  const resellerReach =
    feeUser?.supplierKind === "producer"
      ? await countResellersListingSupplier(session.user.id).catch(() => null)
      : null

  const trustTier = coerceSupplierTrustTier(feeUser?.supplierTrustTier, false)
  const displayTier = trustTier !== "NONE" ? trustTier : trustSnapshot.tier

  return (
    <main className={missionControlCanvas}>
      <BentoContainer maxWidth="7xl" className="space-y-6 py-8 sm:py-10">
        <SupplierMissionControlLive>
          {/* 1 — who you are, what you can do, anything blocking (KYC) */}
          <div className="space-y-3">
            <SupplierMissionControlHeader
              supplierId={session.user.id}
              storeSlug={data.storeSlug}
              storeName={data.storeName}
              publishedSkuCount={data.productCount}
              draftCount={data.draftCount}
              lowStockCount={data.urgent.lowStockCount}
            />
            <SupplierInviteContextBanner />

            {!publishReadiness.verification.allowed ? (
              <SupplierKycPublishBanner
                allowed={publishReadiness.verification.allowed}
                reason={publishReadiness.verification.reason}
                status={publishReadiness.verification.status}
                draftCount={publishReadiness.draftCount}
              />
            ) : null}
          </div>

          <div className="space-y-6">
            {/* 2 — the four numbers a supplier checks first */}
            <SupplierKpiStrip analytics={analytics} data={data} locale={locale} />

            {/* 3 — what needs action now (orders to ship, stockouts, messages) — or the first-sale checklist */}
            {firstSaleProgress.showChecklist ? (
              <SupplierOnboardingChecklist progress={firstSaleProgress} />
            ) : (
              <SupplierUrgentActions urgent={data.urgent} />
            )}

            {/* 4 — performance (main column) next to status & discovery (side column) */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start">
              <div className="min-w-0 space-y-6">
                <SupplierAnalyticsWidget analytics={analytics} />

                {!firstSaleProgress.showChecklist ? (
                  <>
                    <SupplierMetricsBar metrics={data.metrics7d} weeklyGoal={data.weeklyGoal} locale={locale} />
                    <SupplierGrowthSection growth={data.growth} />
                  </>
                ) : null}

                {data.weeklyGoal && data.metrics7d.hasPriorPeriodData ? (
                  <SupplierWeeklyGoalCard goal={data.weeklyGoal} locale={locale} />
                ) : null}
              </div>

              <aside className="min-w-0 space-y-6">
                <SupplierPublishReadinessCard readiness={publishReadiness} />
                <SupplierEscrowPulseCard summary={data.escrow} locale={copyLocale} />
                <RadarSupplierDiscoveryCard supplierKind={feeUser?.supplierKind} resellerReach={resellerReach} />
                <SupplierProductRequestsTeaser />
              </aside>
            </div>

            {/* 5 — reference material, folded away so the page stays about what needs action */}
            <details className="group rounded-2xl border border-zinc-200/80 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tMore("title")}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{tMore("hint")}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-zinc-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="grid gap-6 border-t border-zinc-200/70 p-5 dark:border-zinc-800 lg:grid-cols-2 lg:items-start">
                <SupplierTrustLadderCard tier={displayTier} metrics={trustSnapshot.metrics} locale={copyLocale} />
                <SupplierFeeGridCard variant="compact" />
              </div>
            </details>

            <SupplierToolsRow />
          </div>
        </SupplierMissionControlLive>
      </BentoContainer>
    </main>
  )
}
