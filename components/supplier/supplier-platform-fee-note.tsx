"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type Props = {
  categoryId: string
  className?: string
}

/** Read-only: the Affisell commission actually taken on this category, on the wholesale price. */
export function SupplierPlatformFeeNote({ categoryId, className }: Props) {
  const t = useTranslations("supplier.platformFee")
  const [percent, setPercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = categoryId.trim()
    if (!id) {
      setPercent(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetch(`/api/supplier/category-affisell-commission?categoryId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data: { effectivePercent?: number }) => {
        if (!cancelled) setPercent(typeof data.effectivePercent === "number" ? data.effectivePercent : null)
      })
      .catch(() => {
        if (!cancelled) setPercent(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId])

  if (!categoryId.trim()) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20",
        className
      )}
    >
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("title")}</p>
      <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
        {loading ? t("loading") : percent != null ? t("rate", { pct: percent.toFixed(1) }) : t("unavailable")}
      </p>
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t("body")}</p>
    </div>
  )
}
