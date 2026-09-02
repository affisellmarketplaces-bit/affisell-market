"use client"

import { useLocale } from "next-intl"

import { commissionnaireCheckoutDisclaimer } from "@/lib/legal/affiliate-commissionnaire-shared"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

type Props = {
  affiliateName: string
  supplierName: string
  className?: string
}

/** PDP / checkout — mandat non-transparent (L132-1). */
export function CommissionnaireCheckoutDisclaimer({
  affiliateName,
  supplierName,
  className,
}: Props) {
  const locale = useLocale() as AppLocale
  const text =
    affiliateName.trim() && supplierName.trim()
      ? commissionnaireCheckoutDisclaimer(
          { affiliateName, supplierName },
          locale.startsWith("en") ? "en" : "fr"
        )
      : null

  if (!text) return null

  return (
    <p
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-900/50 dark:text-zinc-400",
        className
      )}
      data-testid="commissionnaire-checkout-disclaimer"
    >
      {text}
    </p>
  )
}
