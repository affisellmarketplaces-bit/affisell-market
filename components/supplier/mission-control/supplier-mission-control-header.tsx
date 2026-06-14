import Link from "next/link"
import { Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { MerchantMyCatalogCue } from "@/components/dashboard/merchant-my-catalog-cue"
import {
  missionControlAffisellMuted,
  missionControlHeading,
  missionControlSurface,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  publishedSkuCount: number
  draftCount: number
  lowStockCount: number
}

function buildCatalogMetrics(
  t: (key: "myCatalogSkuCount" | "myCatalogDraftCount" | "myCatalogLowStock", values: { count: number }) => string,
  publishedSkuCount: number,
  draftCount: number,
  lowStockCount: number
): string {
  const parts = [t("myCatalogSkuCount", { count: publishedSkuCount })]
  if (draftCount > 0) {
    parts.push(t("myCatalogDraftCount", { count: draftCount }))
  }
  if (lowStockCount > 0) {
    parts.push(t("myCatalogLowStock", { count: lowStockCount }))
  }
  return parts.join(" · ")
}

export async function SupplierMissionControlHeader({
  storeName,
  publishedSkuCount,
  draftCount,
  lowStockCount,
}: Props) {
  const t = await getTranslations("supplierDashboard.header")
  const catalogMetrics = buildCatalogMetrics(t, publishedSkuCount, draftCount, lowStockCount)

  return (
    <header className={cn(missionControlSurface, "p-4")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", missionControlAffisellMuted)}>
              {t("eyebrow")}
            </p>
            <h1 className={cn("mt-1.5 text-base leading-snug sm:text-lg", missionControlHeading)}>
              <span className={cn("font-normal", missionControlAffisellMuted)}>{t("greetingHello")}</span>{" "}
              {storeName}
            </h1>
          </div>
          <Link
            href="/dashboard/supplier/products/new"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "inline-flex w-full shrink-0 items-center justify-center gap-2 sm:w-auto",
              "border-brand/25 bg-brand-muted/50 text-brand",
              "hover:border-brand/35 hover:bg-brand-muted/70 hover:text-brand-hover",
              "dark:border-brand-light/25 dark:bg-brand-muted/30 dark:text-brand-light dark:hover:bg-brand-muted/45"
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("newProduct")}
          </Link>
        </div>
        <MerchantMyCatalogCue
          href="/dashboard/supplier/products"
          label={t("myCatalog")}
          metrics={catalogMetrics}
          actionLabel={t("myCatalogOpen")}
          variant="supplier"
          surface="light"
        />
      </div>
    </header>
  )
}
