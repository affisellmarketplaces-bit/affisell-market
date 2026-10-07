"use client"

import { Truck } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type Props = {
  /** `hint`: one line under a price field. `card`: the full explanation (shipping section). */
  variant?: "hint" | "card"
  className?: string
}

/**
 * Buyers are never charged shipping — Checkout carries the product lines only and the settlement has no shipping term —
 * so a supplier's delivery cost has to live inside the catalogue price. This is the one place that says so.
 */
export function SupplierShippingIncludedNotice({ variant = "card", className }: Props) {
  const t = useTranslations("supplier.shippingIncluded")

  if (variant === "hint") {
    return <p className={cn("mt-1 text-xs text-zinc-500 dark:text-zinc-400", className)}>{t("priceHint")}</p>
  }

  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/30",
        className
      )}
    >
      <Truck className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-sky-950 dark:text-sky-100">{t("title")}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-sky-900/85 dark:text-sky-200/85">{t("body")}</p>
      </div>
    </div>
  )
}
