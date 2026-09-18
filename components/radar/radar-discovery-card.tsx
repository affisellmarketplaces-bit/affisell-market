import Link from "next/link"
import { useTranslations } from "next-intl"
import { Radar, Rocket, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { parseSupplierKind } from "@/lib/supplier-kind"
import { cn } from "@/lib/utils"

type SupplierCardProps = {
  supplierKind: string | null | undefined
  /** Real count of resellers listing this supplier's products (producer kind). */
  resellerReach?: number | null
  className?: string
}

type AffiliateCardProps = {
  isFreePlan?: boolean
  className?: string
}

function glassCard(className?: string) {
  return cn(
    "relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-xl sm:p-6",
    "bg-white/55 dark:bg-zinc-950/60",
    className
  )
}

/**
 * Supplier dashboard Radar discovery card — kind-aware CTAs.
 */
export function RadarSupplierDiscoveryCard({
  supplierKind,
  resellerReach = null,
  className,
}: SupplierCardProps) {
  const t = useTranslations("radarDiscovery")
  const kind = parseSupplierKind(supplierKind)

  if (kind === "producer") {
    return (
      <div
        className={glassCard(
          cn(
            "border-violet-400/50 shadow-[0_0_40px_rgba(124,58,237,0.18)]",
            className
          )
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-[#7C3AED]">
              <Shield className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
                {resellerReach != null && resellerReach > 0
                  ? t("producerTitle", { n: resellerReach })
                  : t("producerTitleNone")}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("producerBody")}
              </p>
            </div>
          </div>
          <Button asChild variant="bentoAccent" className="shrink-0">
            <Link href="/radar">{t("producerCta")}</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (kind === "stocker") {
    return (
      <div
        className={glassCard(
          cn(
            "border-emerald-400/50 shadow-[0_0_40px_rgba(5,150,105,0.18)]",
            className
          )
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Rocket className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
                {t("stockerTitle")}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("stockerBody")}
              </p>
            </div>
          </div>
          <Button asChild variant="bentoAccent" className="shrink-0">
            <Link href="/radar">{t("stockerCta")}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={glassCard(
        cn(
          "border-violet-400/50 bg-gradient-to-br from-violet-500/10 via-white/55 to-emerald-500/10",
          "shadow-[0_0_40px_rgba(124,58,237,0.2)]",
          className
        )
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-[#7C3AED]">
            <Radar className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
              {t("unsetTitle")}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("unsetBody")}
            </p>
          </div>
        </div>
        <Button asChild variant="bentoAccent" className="shrink-0">
          <Link href="/dashboard/supplier/onboarding/kind">{t("unsetCta")}</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * Reseller (AFFILIATE) dashboard Radar discovery card.
 */
export function RadarAffiliateDiscoveryCard({
  isFreePlan = true,
  className,
}: AffiliateCardProps) {
  const t = useTranslations("radarDiscovery")
  return (
    <div
      className={glassCard(
        cn(
          "border-violet-400/40 shadow-[0_0_36px_rgba(124,58,237,0.16)]",
          className
        )
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-[#7C3AED]">
            <Radar className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
              {t("affiliateTitle")}
            </p>
            {isFreePlan ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("affiliateBodyFree")}
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("affiliateBodyPaid")}
              </p>
            )}
          </div>
        </div>
        <Button asChild variant="bentoAccent" className="shrink-0">
          <Link href="/radar">{t("affiliateCta")}</Link>
        </Button>
      </div>
    </div>
  )
}
