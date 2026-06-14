import Link from "next/link"
import { Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { MerchantMyCatalogCue } from "@/components/dashboard/merchant-my-catalog-cue"
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
    <header
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white/75 p-4 shadow-sm backdrop-blur-sm",
        "dark:border-zinc-800 dark:bg-zinc-950/60"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1.5 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50 sm:text-lg">
              <span className="font-normal text-zinc-500 dark:text-zinc-400">{t("greetingHello")}</span>{" "}
              {storeName}
            </h1>
          </div>
          <Link
            href="/dashboard/supplier/products/new"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "inline-flex w-full shrink-0 items-center justify-center gap-2 border-violet-200 bg-white text-violet-700",
              "hover:border-violet-300 hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-950 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:w-auto"
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
