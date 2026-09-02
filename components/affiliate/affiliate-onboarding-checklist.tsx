import Link from "next/link"
import { CheckCircle2, Circle, Compass, Landmark, Share2, Store } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { BentoCard } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import type { MerchantFirstSaleProgress, MerchantOnboardingStepId } from "@/lib/merchant-first-sale-progress"
import { cn } from "@/lib/utils"

type Props = {
  progress: MerchantFirstSaleProgress
}

const stepIcons: Record<Exclude<MerchantOnboardingStepId, "kyc">, typeof Compass> = {
  connect: Landmark,
  create: Compass,
  publish: Store,
  share: Share2,
}

const stepLabelKeys: Record<Exclude<MerchantOnboardingStepId, "kyc">, string> = {
  connect: "stepConnect",
  create: "stepCreate",
  publish: "stepPublish",
  share: "stepShare",
}

const stepCtaKeys: Record<Exclude<MerchantOnboardingStepId, "kyc">, string> = {
  connect: "ctaConnect",
  create: "ctaCreate",
  publish: "ctaPublish",
  share: "ctaShare",
}

export async function AffiliateOnboardingChecklist({ progress }: Props) {
  const t = await getTranslations("affiliateDashboard.onboarding")

  if (!progress.showChecklist) return null

  const doneCount = progress.steps.filter((s) => s.done).length

  return (
    <BentoCard className="border-violet-200/70 p-6 dark:border-violet-900/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("title")}</h2>
        <p className="text-xs font-medium tabular-nums text-violet-700 dark:text-violet-300">
          {t("progress", { done: doneCount, total: progress.steps.length })}
        </p>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      {!progress.kycApproved ? (
        <p className="mt-3 rounded-lg border border-violet-200/80 bg-violet-50/90 px-3 py-2 text-xs leading-relaxed text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100">
          {t("kycDeferredHint")}
          {progress.draftListingCount > 0 ? ` ${t("draftReadyHint", { count: progress.draftListingCount })}` : ""}
        </p>
      ) : null}
      <ol className="mt-5 space-y-3">
        {progress.steps.map((step, index) => {
          if (step.id === "kyc") return null
          const stepId = step.id as Exclude<MerchantOnboardingStepId, "kyc">
          const Icon = stepIcons[stepId]
          const isNext = progress.nextStepId === step.id
          const hasDraftToResume =
            step.id === "publish" && progress.draftListingCount > 0 && Boolean(progress.latestDraftHref)
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
                    step.done ? "text-emerald-800 dark:text-emerald-200" : "text-zinc-700 dark:text-zinc-300"
                  )}
                >
                  <span className="text-zinc-400">{index + 1}. </span>
                  {t(stepLabelKeys[stepId])}
                </p>
                {!step.done && isNext ? (
                  <>
                    <Link
                      href={step.href}
                      className={cn(buttonVariants({ size: "sm" }), "mt-2 gap-1.5 bg-violet-600 hover:bg-violet-700")}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {t(hasDraftToResume ? "ctaResumeDraft" : stepCtaKeys[stepId])}
                    </Link>
                    {hasDraftToResume ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {t("resumeDraftHint", { count: progress.draftListingCount })}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </BentoCard>
  )
}
