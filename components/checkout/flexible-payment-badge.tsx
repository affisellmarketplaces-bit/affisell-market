"use client"

import { CreditCard, Sparkles, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  isKlarnaEligibleCents,
  klarnaInstallmentCents,
  MARKETPLACE_BNPL_INSTALLMENTS,
} from "@/lib/marketplace-checkout-payment-methods"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  amountCents: number
  compact?: boolean
  className?: string
}

export function FlexiblePaymentBadge({ amountCents, compact = false, className }: Props) {
  const t = useTranslations("checkout.flexiblePayment")

  if (!isKlarnaEligibleCents(amountCents)) return null

  const installmentCents = klarnaInstallmentCents(amountCents, MARKETPLACE_BNPL_INSTALLMENTS)
  const installmentLabel = formatStoreCurrencyFromCents(installmentCents)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-cyan-50/60 shadow-sm dark:border-violet-800/40 dark:from-violet-950/40 dark:via-zinc-950 dark:to-cyan-950/20",
        compact ? "p-2.5" : "p-4",
        className
      )}
      role="note"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-cyan-300/25 blur-2xl dark:bg-cyan-500/15"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25",
            compact ? "h-9 w-9" : "h-10 w-10"
          )}
        >
          <Wallet className={cn(compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
            <span className={cn("font-semibold text-zinc-900 dark:text-zinc-50", compact ? "text-xs" : "text-sm")}>
              {t("title")}
            </span>
          </p>
          <p
            className={cn(
              "mt-1 font-extrabold tabular-nums text-violet-800 dark:text-violet-200",
              compact ? "text-sm" : "text-lg"
            )}
          >
            {t("installments", {
              count: MARKETPLACE_BNPL_INSTALLMENTS,
              amount: installmentLabel,
            })}
          </p>
          <p
            className={cn(
              "mt-1 text-zinc-600 dark:text-zinc-400",
              compact ? "text-[10px] leading-snug" : "text-xs leading-relaxed"
            )}
          >
            {t("footnote")}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/90 bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200">
              Klarna
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/90 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <CreditCard className="h-3 w-3 opacity-70" aria-hidden />
              {t("cardAlso")}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
