"use client"

import Link from "next/link"
import { AlertCircle, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  allowed: boolean
  reason?: string | null
  status?: string | null
  draftCount?: number
  className?: string
  compact?: boolean
}

function reasonCopyKey(reason: string | null | undefined): "noProfile" | "pending" | "rejected" | "needsInfo" {
  if (reason === "no_profile") return "noProfile"
  if (reason === "rejected") return "rejected"
  if (reason === "needs_info") return "needsInfo"
  return "pending"
}

/** Blocks live publish until affiliate KYC is approved — drafts still allowed. */
export function AffiliateKycPublishBanner({
  allowed,
  reason,
  status,
  draftCount = 0,
  className,
  compact = false,
}: Props) {
  const t = useTranslations("affiliateDashboard.kycPublish")

  if (allowed) return null

  const reasonKey = reasonCopyKey(reason ?? undefined)

  return (
    <section
      role="alert"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-50 via-white to-violet-50/40 shadow-sm dark:border-amber-800/60 dark:from-amber-950/35 dark:via-zinc-950 dark:to-violet-950/20",
        compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            {reason === "rejected" ? (
              <AlertCircle className="size-5" aria-hidden />
            ) : (
              <ShieldCheck className="size-5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
              {t("badge")}
            </p>
            <h2 className={cn("mt-1 font-semibold text-zinc-900 dark:text-zinc-50", compact ? "text-sm" : "text-base")}>
              {t("title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{t(`body.${reasonKey}`)}</p>
            {draftCount > 0 ? (
              <p className="mt-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                {t("draftWaiting", { count: draftCount })}
              </p>
            ) : null}
            {status ? (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{status}</p>
            ) : null}
          </div>
        </div>
        <Link
          href="/dashboard/verification"
          className={cn(
            buttonVariants({ size: compact ? "sm" : "default" }),
            "shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600"
          )}
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  )
}
