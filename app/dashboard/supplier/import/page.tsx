import Link from "next/link"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { getTranslations } from "next-intl/server"
import { ArrowUpRight, Sparkles } from "lucide-react"

import { BentoShell } from "@/components/affisell/bento-ui"
import { SupplierProductImport } from "@/components/supplier-product-import"
import { DROPFORGE_HREF } from "@/lib/affiliate-onboarding-shared"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function SupplierImportPage() {
  await requireSupplierSession("/dashboard/supplier/import")
  const t = await getTranslations("importPage")

  return (
    <BentoShell>
      <div className="mb-6 overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/80 via-zinc-950 to-fuchsia-950/40 p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
              <Sparkles className="size-3.5" aria-hidden />
              {t("productTag")}
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white">{t("productName")}</h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-300">{t("subtitle")}</p>
          </div>
          <Link
            href={DROPFORGE_HREF}
            className={cn(
              buttonVariants(),
              "shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
            )}
          >
            {t("scanCta")}
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <SupplierProductImport />
    </BentoShell>
  )
}
