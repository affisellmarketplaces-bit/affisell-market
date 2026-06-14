import Link from "next/link"
import { CheckCircle2, Circle, Package, Share2, Store } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  missionControlAffisellMuted,
  missionControlAffisellSubtext,
  missionControlHeading,
  missionControlPanel,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string | null
}

const stepIds = ["create", "publish", "share"] as const
const stepIcons = { create: Package, publish: Store, share: Share2 } as const

export async function SupplierOnboardingChecklist({ storeSlug }: Props) {
  const t = await getTranslations("supplierDashboard.onboarding")
  const shareHref = storeSlug ? `/store/supplier/${storeSlug}` : "/marketplace"

  const steps = [
    { id: "create" as const, href: "/dashboard/supplier/products/new" },
    { id: "publish" as const, href: "/dashboard/supplier/products" },
    { id: "share" as const, href: shareHref },
  ]

  return (
    <section aria-labelledby="onboarding-heading" className={cn(missionControlPanel, "p-6")}>
      <h2 id="onboarding-heading" className={cn("text-lg", missionControlHeading)}>
        {t("title")}
      </h2>
      <p className={cn("mt-1 text-sm", missionControlAffisellSubtext)}>{t("subtitle")}</p>
      <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        {t("vatNotice")}
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.id]
          const done = false
          const labelKey =
            step.id === "create" ? "stepCreate" : step.id === "publish" ? "stepPublish" : "stepShare"
          return (
            <li key={step.id} className="flex items-start gap-3">
              {done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-violet-300 dark:text-violet-600" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", missionControlAffisellSubtext)}>
                  <span className={missionControlAffisellMuted}>{index + 1}. </span>
                  {t(labelKey)}
                </p>
                <Link
                  href={step.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-2 gap-1.5 border-violet-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {t("start")}
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
