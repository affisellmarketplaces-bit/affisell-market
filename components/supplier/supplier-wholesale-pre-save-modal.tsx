"use client"

import { AlertTriangle, Shield, Sparkles, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import type { SupplierWholesalePreview } from "@/lib/supplier-wholesale-pre-save-client"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  preview: SupplierWholesalePreview | null
  productId?: string
  busy?: boolean
  recallBusy?: boolean
  onRecall?: () => void
  onCancel: () => void
}

export function SupplierWholesalePreSaveModal({
  open,
  preview,
  busy = false,
  recallBusy = false,
  onRecall,
  onCancel,
}: Props) {
  const t = useTranslations("supplierDashboard.priceShield")

  if (!open || !preview) return null

  const partners = preview.affiliateListingsLive

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-shield-title"
    >
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-400/30",
          "bg-gradient-to-br from-zinc-950 via-violet-950/90 to-zinc-950 shadow-2xl shadow-cyan-500/10"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.35), transparent)",
          }}
        />

        <div className="relative p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30">
              <Shield className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">
                <Sparkles className="size-3" aria-hidden />
                Price Shield
              </p>
              <h2
                id="price-shield-title"
                className="mt-1 text-lg font-semibold text-white"
              >
                {t("title")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {t("body", { partners })}
              </p>
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <span className="mt-0.5 text-emerald-400" aria-hidden>
                  ↓
                </span>
                {t("decreaseHint")}
              </p>
              {preview.atLossCount > 0 ? (
                <p className="mt-2 flex items-start gap-2 text-xs text-amber-200/90">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {t("atLoss", { count: preview.atLossCount })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy || recallBusy}
              className="rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
              aria-label={t("cancel")}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy || recallBusy}
              onClick={onCancel}
              className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/10"
            >
              {t("cancel")}
            </Button>
            {onRecall ? (
              <Button
                type="button"
                disabled={busy || recallBusy}
                onClick={onRecall}
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500"
              >
                {recallBusy ? t("recalling") : t("recallCta")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
