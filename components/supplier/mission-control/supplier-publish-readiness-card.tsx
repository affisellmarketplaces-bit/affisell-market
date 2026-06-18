import Link from "next/link"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  missionControlAffisellMuted,
  missionControlAffisellSubtext,
  missionControlHeading,
  missionControlPanel,
  missionControlVioletCtaSm,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { buttonVariants } from "@/components/ui/button"
import type { SupplierPublishReadiness } from "@/lib/supplier-publish-readiness"
import { cn } from "@/lib/utils"

type Props = {
  readiness: SupplierPublishReadiness
}

/** Mission Control tile — KYC vs drafts ready to publish. */
export async function SupplierPublishReadinessCard({ readiness }: Props) {
  const t = await getTranslations("supplierDashboard.publishReadiness")
  const { verification, draftCount, publishedCount, readyToPublish, kycBlocked } = readiness

  return (
    <section aria-labelledby="publish-readiness-heading" className={cn(missionControlPanel, "p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
            {t("eyebrow")}
          </p>
          <h2 id="publish-readiness-heading" className={cn("mt-1 text-lg", missionControlHeading)}>
            {t("title")}
          </h2>
          <p className={cn("mt-1 text-sm", missionControlAffisellSubtext)}>{t("subtitle")}</p>
        </div>
        <ShieldCheck className="size-5 shrink-0 text-violet-500 dark:text-violet-300" aria-hidden />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{publishedCount}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{t("metricLive")}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{draftCount}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{t("metricDrafts")}</p>
        </div>
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5 text-center",
            verification.allowed
              ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30"
              : "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/30"
          )}
        >
          <p className="text-lg font-bold tabular-nums">
            {verification.allowed ? (
              <CheckCircle2 className="mx-auto size-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              "!"
            )}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{t("metricKyc")}</p>
        </div>
      </div>

      <p className={cn("mt-4 text-sm leading-relaxed", missionControlAffisellSubtext)}>
        {kycBlocked
          ? t("stateKycBlocked", { count: draftCount })
          : readyToPublish
            ? t("stateReady", { count: draftCount })
            : verification.allowed
              ? t("stateApprovedNoDraft")
              : t("stateVerifyFirst")}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {!verification.allowed ? (
          <Link
            href="/dashboard/verification"
            className={cn(buttonVariants({ size: "sm" }), "bg-amber-600 text-white hover:bg-amber-700")}
          >
            {t("ctaVerify")}
          </Link>
        ) : null}
        {readyToPublish ? (
          <Link
            href="/dashboard/supplier/products?filter=draft"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            {t("ctaPublishDrafts")}
          </Link>
        ) : (
          <Link href="/dashboard/supplier/products/new" className={missionControlVioletCtaSm}>
            {t("ctaNewProduct")}
          </Link>
        )}
      </div>

      <p className={cn("mt-3 text-[11px]", missionControlAffisellMuted)}>{t("footnote")}</p>
    </section>
  )
}
