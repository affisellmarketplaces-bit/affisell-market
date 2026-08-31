import Link from "next/link"
import { CheckCircle2, Circle, Package, Share2, ShieldCheck, Store } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  missionControlAffisellMuted,
  missionControlAffisellSubtext,
  missionControlHeading,
  missionControlPanel,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { buttonVariants } from "@/components/ui/button"
import type { MerchantFirstSaleProgress, SupplierOnboardingStepId } from "@/lib/merchant-first-sale-progress"
import { cn } from "@/lib/utils"

type Props = {
  progress: MerchantFirstSaleProgress
}

const stepIcons: Record<SupplierOnboardingStepId, typeof Package> = {
  kyc: ShieldCheck,
  create: Package,
  publish: Store,
  share: Share2,
}

const stepLabelKeys: Record<SupplierOnboardingStepId, string> = {
  kyc: "stepKyc",
  create: "stepCreate",
  publish: "stepPublish",
  share: "stepShare",
}

export async function SupplierOnboardingChecklist({ progress }: Props) {
  const t = await getTranslations("supplierDashboard.onboarding")

  if (!progress.showChecklist) return null

  return (
    <section aria-labelledby="onboarding-heading" className={cn(missionControlPanel, "p-6")}>
      <h2 id="onboarding-heading" className={cn("text-lg", missionControlHeading)}>
        {t("title")}
      </h2>
      <p className={cn("mt-1 text-sm", missionControlAffisellSubtext)}>{t("subtitle")}</p>
      {!progress.kycApproved ? (
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {t("kycHint")}
        </p>
      ) : null}
      <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        {t("vatNotice")}
      </p>
      <ol className="mt-5 space-y-3">
        {progress.steps.map((step, index) => {
          if (step.id === "connect") return null
          const Icon = stepIcons[step.id]
          const isNext = progress.nextStepId === step.id
          const labelKey = stepLabelKeys[step.id]
          return (
            <li key={step.id} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    isNext ? "text-violet-600 dark:text-violet-400" : "text-violet-300 dark:text-violet-600"
                  )}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-emerald-800 dark:text-emerald-200" : missionControlAffisellSubtext
                  )}
                >
                  <span className={missionControlAffisellMuted}>{index + 1}. </span>
                  {t(labelKey)}
                </p>
                {!step.done && isNext ? (
                  <Link
                    href={step.href}
                    className={cn(
                      buttonVariants({ variant: isNext ? "default" : "outline", size: "sm" }),
                      "mt-2 gap-1.5",
                      isNext && "bg-violet-600 hover:bg-violet-700"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {t("start")}
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
