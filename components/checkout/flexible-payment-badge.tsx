"use client"

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
  /** @deprecated use default inline chip — kept for callers */
  compact?: boolean
  className?: string
}

/** Compact BNPL chip — inline under price, not a full-width banner. */
export function FlexiblePaymentBadge({ amountCents, compact: _compact, className }: Props) {
  const t = useTranslations("checkout.flexiblePayment")

  if (!isKlarnaEligibleCents(amountCents)) return null

  const installmentCents = klarnaInstallmentCents(amountCents, MARKETPLACE_BNPL_INSTALLMENTS)
  const installmentLabel = formatStoreCurrencyFromCents(installmentCents)
  const aria = t("aria", {
    count: MARKETPLACE_BNPL_INSTALLMENTS,
    amount: installmentLabel,
  })

  return (
    <div
      className={cn(
        "inline-flex w-max max-w-full items-center gap-2 rounded-full",
        "border border-violet-200/75 bg-violet-50/85 px-2.5 py-1.5",
        "text-violet-950 shadow-sm backdrop-blur-sm",
        "dark:border-violet-500/20 dark:bg-violet-950/35 dark:text-violet-50",
        className
      )}
      role="note"
      aria-label={aria}
    >
      <span
        className="inline-flex items-baseline gap-1 tabular-nums"
        aria-hidden
      >
        <span className="text-[11px] font-black tracking-tight text-violet-600 dark:text-violet-300">
          {MARKETPLACE_BNPL_INSTALLMENTS}×
        </span>
        <span className="text-xs font-semibold">{installmentLabel}</span>
      </span>

      <span className="h-3 w-px shrink-0 bg-violet-200/90 dark:bg-violet-500/25" aria-hidden />

      <span className="inline-flex shrink-0 items-center gap-1">
        <span className="rounded-full border border-emerald-200/80 bg-emerald-50/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t("zeroApr")}
        </span>
        <span className="hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-700/70 dark:text-violet-300/70 sm:inline">
          {t("methods")}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
        {Array.from({ length: MARKETPLACE_BNPL_INSTALLMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 rounded-full",
              i === 0 ? "w-2 bg-violet-500/80 dark:bg-violet-400/70" : "w-1 bg-violet-300/50 dark:bg-violet-600/40"
            )}
          />
        ))}
      </span>
    </div>
  )
}
