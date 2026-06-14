import Image from "next/image"
import Link from "next/link"
import { Archive, Lightbulb, Rocket, TrendingUp } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { SupplierOpportunityBoostButton } from "@/components/supplier/mission-control/supplier-opportunity-boost-button"
import {
  missionControlAffisellMuted,
  missionControlAffisellSubtext,
  missionControlDivider,
  missionControlHeading,
  missionControlPanel,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import type { SupplierGrowthSnapshot } from "@/lib/supplier-mission-control"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  growth: SupplierGrowthSnapshot
}

export async function SupplierGrowthSection({ growth }: Props) {
  const t = await getTranslations("supplierDashboard.growth")
  const opp = growth.topOpportunity

  return (
    <section aria-labelledby="growth-heading" className="grid gap-6 lg:grid-cols-2">
      <div className={cn(missionControlPanel, "space-y-4 p-5")}>
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            💡
          </span>
          <h2 id="growth-heading" className={cn("text-sm", missionControlHeading)}>
            {t("opportunities")}
          </h2>
        </div>

        {!opp ? (
          <p className={missionControlAffisellSubtext}>{t("noOpportunity")}</p>
        ) : (
          <div className="space-y-4">
            <p className={cn("text-sm leading-relaxed", missionControlAffisellSubtext)}>
              <span className="font-semibold text-violet-900 dark:text-violet-100">
                {opp.affiliateViewerCount === 1
                  ? t("affiliateInterestOne", { count: opp.affiliateViewerCount })
                  : t("affiliateInterestMany", { count: opp.affiliateViewerCount })}
              </span>{" "}
              <span className="font-medium">« {opp.productName} »</span>
            </p>
            <p className="flex items-start gap-2 rounded-xl border border-violet-200/60 bg-violet-50/70 px-3 py-2.5 text-sm text-violet-950 dark:border-violet-500/20 dark:bg-violet-950/35 dark:text-violet-100">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span>
                {opp.estimatedExtraSales7d === 1
                  ? t("estimateSalesOne", { count: opp.estimatedExtraSales7d })
                  : t("estimateSalesMany", { count: opp.estimatedExtraSales7d })}{" "}
                ·{" "}
                {t("commissionFromTo", {
                  from: opp.currentCommissionPct,
                  to: opp.suggestedCommissionPct,
                })}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <SupplierOpportunityBoostButton opportunity={opp} />
              <Link
                href={`/dashboard/supplier/products/${opp.productId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {t("viewListing")}
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className={cn(missionControlPanel, "space-y-4 p-5")}>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
          <h2 className={cn("text-sm", missionControlHeading)}>{t("catalogPerformance")}</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <p className={cn("text-3xl font-semibold tabular-nums", missionControlHeading)}>
            {growth.adoptionRatePct}%
          </p>
          <p className={missionControlAffisellMuted}>{t("adoptionRate")}</p>
        </div>
        <p className={cn("text-xs", missionControlAffisellMuted)}>
          {t("skuBreakdown", { withSales: growth.skusWithSales, total: growth.totalSkus })}
        </p>

        <div className={cn("border-t pt-4", missionControlDivider)}>
          <p className={cn("text-xs font-semibold uppercase tracking-wide", missionControlAffisellMuted)}>
            {t("dormantTitle")}
          </p>
          {growth.dormantSkus.length === 0 ? (
            <p className={cn("mt-2 text-sm", missionControlAffisellMuted)}>{t("dormantNone")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {growth.dormantSkus.map((sku) => (
                <li
                  key={sku.id}
                  className="flex items-center gap-3 rounded-xl border border-violet-200/50 px-2 py-2 dark:border-violet-500/15"
                >
                  {sku.imageUrl ? (
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-violet-100 dark:bg-violet-950/50">
                      <Image src={sku.imageUrl} alt="" fill className="object-cover" sizes="36px" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-md bg-violet-100 dark:bg-violet-950/50" />
                  )}
                  <p className={cn("min-w-0 flex-1 truncate text-sm font-medium", missionControlAffisellSubtext)}>
                    {sku.name}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Link
                      href={`/dashboard/supplier/products/${sku.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                    >
                      <Rocket className="mr-1 h-3 w-3" aria-hidden />
                      {t("ctaBoost")}
                    </Link>
                    <Link
                      href={`/dashboard/supplier/products/${sku.id}?archive=1`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2 text-xs")}
                    >
                      <Archive className="h-3 w-3" aria-hidden />
                      <span className="sr-only">{t("ctaArchive")}</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
