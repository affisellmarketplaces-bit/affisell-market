import { Banknote, PackageCheck, Truck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
  PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
} from "@/lib/payout-policy-copy-shared"

export async function AffiliatePayoutRailTimeline() {
  const t = await getTranslations("affiliate.settings.payouts.timeline")

  const steps = [
    { icon: Banknote, title: t("stepConnectTitle"), body: t("stepConnectBody") },
    { icon: Truck, title: t("stepDeliveryTitle"), body: t("stepDeliveryBody") },
    {
      icon: PackageCheck,
      title: t("stepReleaseTitle"),
      body: t("stepReleaseBody", {
        confirmDays: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
        autoDays: AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
      }),
    },
  ] as const

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      <ol className="mt-5 space-y-4">
        {steps.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                <Icon className="size-4" aria-hidden />
              </span>
              {index < steps.length - 1 ? (
                <span className="mt-1 h-full min-h-6 w-px bg-violet-200 dark:bg-violet-900" aria-hidden />
              ) : null}
            </div>
            <div className="pb-1 pt-0.5">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <span className="mr-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
                  {index + 1}.
                </span>
                {title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
