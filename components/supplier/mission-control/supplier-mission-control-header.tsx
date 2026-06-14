import Link from "next/link"
import { Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { MerchantMyCatalogCue } from "@/components/dashboard/merchant-my-catalog-cue"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
}

export async function SupplierMissionControlHeader({ storeName }: Props) {
  const t = await getTranslations("supplierDashboard.header")

  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-6 dark:border-zinc-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            {t("greeting", { storeName })}
          </h1>
        </div>
        <Link
          href="/dashboard/supplier/products/new"
          className={cn(
            buttonVariants({ size: "default" }),
            "inline-flex shrink-0 items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("newProduct")}
        </Link>
      </div>
      <MerchantMyCatalogCue
        href="/dashboard/supplier/products"
        label={t("myCatalog")}
        hint={t("myCatalogHint")}
        actionLabel={t("myCatalogOpen")}
        variant="supplier"
      />
    </header>
  )
}
