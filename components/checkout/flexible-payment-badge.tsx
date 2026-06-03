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
  compact?: boolean
  className?: string
}

export function FlexiblePaymentBadge({ amountCents, compact = false, className }: Props) {
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
        "affisell-pay-flex relative overflow-hidden rounded-2xl border border-violet-500/25",
        "bg-gradient-to-br from-zinc-950 via-violet-950/95 to-zinc-900 text-white",
        "shadow-[0_0_32px_-8px_rgba(139,92,246,0.55)]",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className
      )}
      role="note"
      aria-label={aria}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.06)_45%,transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-violet-500/30 blur-2xl"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "shrink-0 font-black tabular-nums tracking-tight text-violet-300",
              compact ? "text-xl" : "text-2xl"
            )}
          >
            {MARKETPLACE_BNPL_INSTALLMENTS}×
          </span>
          <span
            className={cn(
              "truncate font-bold tabular-nums text-white",
              compact ? "text-base" : "text-lg"
            )}
          >
            {installmentLabel}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/15 font-bold uppercase tracking-wider text-emerald-300",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
          )}
        >
          {t("zeroApr")}
        </span>
      </div>

      {!compact ? (
        <div className="relative mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: MARKETPLACE_BNPL_INSTALLMENTS }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full",
                  i === 0 ? "w-6 bg-violet-400" : "w-3 bg-white/15"
                )}
              />
            ))}
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {t("methods")}
          </p>
        </div>
      ) : (
        <p className="relative mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {t("methods")}
        </p>
      )}
    </div>
  )
}
