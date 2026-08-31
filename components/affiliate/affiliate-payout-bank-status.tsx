"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Building2, CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type ConnectStatus = {
  hasAccount: boolean
  transfersActive: boolean
  bankLast4: string | null
  bankName: string | null
  requirementsDue: string[]
  payoutsEnabled: boolean
}

type Props = {
  initialTransfersActive: boolean
  initialBankLast4: string | null
  initialBankName: string | null
}

export function AffiliatePayoutBankStatus({
  initialTransfersActive,
  initialBankLast4,
  initialBankName,
}: Props) {
  const t = useTranslations("affiliate.settings.payouts.bankStatus")
  const [status, setStatus] = useState<ConnectStatus>({
    hasAccount: initialTransfersActive || Boolean(initialBankLast4),
    transfersActive: initialTransfersActive,
    bankLast4: initialBankLast4,
    bankName: initialBankName,
    requirementsDue: [],
    payoutsEnabled: initialTransfersActive,
  })
  const [loading, setLoading] = useState(!initialTransfersActive)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/stripe/connect/status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConnectStatus | null) => {
        if (cancelled || !data) return
        setStatus(data)
      })
      .catch(() => {
        /* keep SSR snapshot */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ready = status.payoutsEnabled && status.transfersActive
  const pending = status.hasAccount && !ready

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
        ready
          ? "border-emerald-300/40 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-teal-950/20"
          : pending
            ? "border-amber-300/40 bg-gradient-to-br from-amber-50/80 via-white to-violet-50/40 dark:border-amber-900/40 dark:from-amber-950/20 dark:via-zinc-950 dark:to-violet-950/20"
            : "border-violet-200/60 bg-gradient-to-br from-violet-50/60 via-white to-fuchsia-50/30 dark:border-violet-900/40 dark:from-violet-950/20 dark:via-zinc-950 dark:to-fuchsia-950/10"
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" aria-hidden />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            ready
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
          )}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : ready ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          ) : (
            <Building2 className="h-5 w-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700/90 dark:text-violet-300/90">
            <Sparkles className="size-3" aria-hidden />
            {t("eyebrow")}
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {ready ? t("titleReady") : pending ? t("titlePending") : t("titleMissing")}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {ready ? t("bodyReady") : pending ? t("bodyPending") : t("bodyMissing")}
          </p>
        </div>
      </div>

      {status.bankLast4 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-4 rounded-xl border border-white/60 bg-white/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("accountLabel")}
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {status.bankName ? `${status.bankName} · ` : ""}
            **** {status.bankLast4}
          </p>
        </motion.div>
      ) : null}

      {status.requirementsDue.length > 0 ? (
        <p className="relative mt-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("requirementsHint")}
        </p>
      ) : null}
    </section>
  )
}
