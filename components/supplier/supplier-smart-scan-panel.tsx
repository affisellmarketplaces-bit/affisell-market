"use client"

import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import { useSupplierSmartScan } from "@/components/supplier/use-supplier-smart-scan"
import type { SmartScanPatch } from "@/lib/supplier-smart-scan"
import { cn } from "@/lib/utils"

type Props = {
  categoryId: string
  categoryPathLabel: string
  name: string
  description: string
  images: string[]
  categoryAttrs: CategoryAttrRow[]
  onApply: (patch: SmartScanPatch) => void
  getLiveValues: () => { description: string; price: string }
}

/**
 * Silent-by-default progress strip for the auto-draft scan: only becomes visible while scanning or
 * once it has something to report (filled fields, or a possible duplicate). Never shown as an error —
 * "skipped" just fades out, since the manual form already works with no scan at all.
 */
export function SupplierSmartScanPanel({
  categoryId,
  categoryPathLabel,
  name,
  description,
  images,
  categoryAttrs,
  onApply,
  getLiveValues,
}: Props) {
  const t = useTranslations("supplier.smartScan")
  const { status, duplicate } = useSupplierSmartScan({
    categoryId,
    categoryPathLabel,
    name,
    description,
    images,
    categoryAttrs,
    onApply,
    getLiveValues,
  })

  if (status === "idle" || status === "skipped") return null

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
        status === "scanning" &&
          "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200",
        status === "done" &&
          (duplicate
            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200")
      )}
    >
      {status === "scanning" ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          <span>{t("scanning")}</span>
        </>
      ) : duplicate ? (
        <>
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>{t("filledWithDuplicateWarning")}</span>
        </>
      ) : (
        <>
          <Check className="size-4 shrink-0" aria-hidden />
          <span>{t("filled")}</span>
        </>
      )}
      <Sparkles className="ml-auto size-3.5 shrink-0 opacity-60" aria-hidden />
    </div>
  )
}
