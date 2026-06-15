"use client"

import { Truck } from "lucide-react"
import { useTranslations } from "next-intl"

import { EU_CHECKOUT_COUNTRY_COUNT } from "@/lib/eu-market-countries"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/** Reminds buyers that checkout ships to EU countries; each line follows its supplier zone. */
export function CartCheckoutShippingNote({ className }: Props) {
  const t = useTranslations("cart.checkoutShippingNote")

  return (
    <div
      className={cn(
        "mb-4 flex gap-3 rounded-xl border border-violet-200/70 bg-violet-50/60 p-3 text-left dark:border-violet-900/40 dark:bg-violet-950/25",
        className
      )}
    >
      <Truck className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">{t("title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-violet-900/90 dark:text-violet-200/90">
          {t("body", { count: EU_CHECKOUT_COUNTRY_COUNT })}
        </p>
      </div>
    </div>
  )
}
