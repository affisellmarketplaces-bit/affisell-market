import Link from "next/link"
import { Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { MerchantMyCatalogCue } from "@/components/dashboard/merchant-my-catalog-cue"
import {
  missionControlAccentFocusSupplier,
  missionControlAffisellMuted,
  missionControlHeaderEyebrow,
  missionControlHeaderRail,
  missionControlHeaderSurface,
  missionControlHeading,
  missionControlVioletBandCta,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
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
    <header className={cn(missionControlHeaderSurface, "p-4 pl-5")}>
      <div className={missionControlHeaderRail} aria-hidden />
      <div className="relative z-[1] flex flex-col gap-3">
        <div className="min-w-0">
          <p className={missionControlHeaderEyebrow}>{t("eyebrow")}</p>
          <h1 className={cn("mt-1.5 text-base leading-snug sm:text-lg", missionControlHeading)}>
            <span className={cn("font-normal", missionControlAffisellMuted)}>{t("greetingHello")}</span>{" "}
            <span className={missionControlAccentFocusSupplier}>{storeName}</span>
          </h1>
        </div>
        <MerchantMyCatalogCue
          href="/dashboard/supplier/products"
          label={t("myCatalog")}
          metrics={catalogMetrics}
          actionLabel={t("myCatalogOpen")}
          variant="supplier"
          surface="light"
        />
        <Link href="/dashboard/supplier/products/new" className={missionControlVioletBandCta}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("newProduct")}
        </Link>
      </div>
    </header>
  )
}
