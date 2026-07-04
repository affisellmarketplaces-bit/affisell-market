"use client"

import { AlertTriangle, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import type { SupplierWholesalePreview } from "@/lib/supplier-wholesale-pre-save-client"

type Props = {
  open: boolean
  preview: SupplierWholesalePreview | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SupplierWholesalePreSaveModal({
  open,
  preview,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const t = useTranslations("supplierDashboard.wholesalePreSave")

  if (!open || !preview) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wholesale-pre-save-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-300/80 bg-white p-6 shadow-2xl dark:border-amber-800/60 dark:bg-zinc-950">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="wholesale-pre-save-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t("title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t("body", {
                partners: preview.affiliateListingsLive,
                atRisk: preview.listingsAtRisk,
              })}
            </p>
            {preview.atLossCount > 0 ? (
              <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                {t("atLoss", { count: preview.atLossCount })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900"
            aria-label={t("cancel")}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? t("confirming") : t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  )
}
