"use client"

import { Check, Loader2, ScanLine, Sparkles, X } from "lucide-react"

import type { PendingCategoryConfirmation } from "@/components/supplier/supplier-category-confirm-types"
import type { CategoryPathSegment } from "@/lib/category-browse"
import type { ListingProductInsight } from "@/lib/listing-product-signal"
import type { ListingCategorySuggestion } from "@/lib/supplier-suggest-listing"
import type { SupplierCategorySuggestMeta } from "@/components/supplier/use-supplier-category-suggestions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  name: string
  imageUrl: string | null
  categoryPath: CategoryPathSegment[]
  categoryId: string
  categoryAiTag: boolean
  loading: boolean
  meta: SupplierCategorySuggestMeta
  topSuggestion: ListingCategorySuggestion | null
  productInsight: ListingProductInsight | null
  pendingConfirm: PendingCategoryConfirmation | null
  onConfirmPending: () => void
  onDismissPending: () => void
}

function confidencePct(conf?: number) {
  if (conf == null || !Number.isFinite(conf)) return null
  return `${Math.round(conf * 100)} %`
}

export function SupplierExpressTaxonomyRail({
  name,
  imageUrl,
  categoryPath,
  categoryId,
  categoryAiTag,
  loading,
  meta,
  topSuggestion,
  productInsight,
  pendingConfirm,
  onConfirmPending,
  onDismissPending,
}: Props) {
  const pathLabel =
    categoryPath.length > 0
      ? categoryPath.map((s) => s.name).join(" › ")
      : topSuggestion?.breadcrumb ?? null

  const awaitingConfirm =
    pendingConfirm != null && categoryId !== pendingConfirm.leafId
  const confirmed = Boolean(categoryId && pathLabel && !awaitingConfirm)
  const scanning = loading && (name.trim().length >= 3 || Boolean(imageUrl))

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-600/[0.08] via-white to-cyan-500/[0.06] p-4 shadow-[0_0_40px_-12px_rgba(124,58,237,0.45)] ring-1 ring-violet-500/15 dark:border-violet-800/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-cyan-950/20"
      aria-live="polite"
    >
      {scanning ? (
        <div
          className="pointer-events-none absolute inset-0 motion-safe:animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden
        />
      ) : null}
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Sparkles className="h-3 w-3" aria-hidden />
          Taxonomie IA
        </span>
        {meta.visionUsed ? (
          <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
            Vision
          </span>
        ) : null}
        {awaitingConfirm ? (
          <span className="rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            À confirmer
          </span>
        ) : null}
        {categoryAiTag && confirmed ? (
          <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Confirmée
          </span>
        ) : null}
      </div>

      <div className="relative mt-3 min-h-[3.5rem]">
        {scanning ? (
          <div className="flex items-center gap-3 text-sm text-violet-900 dark:text-violet-100">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600" aria-hidden />
            <div>
              <p className="font-medium">Scan du produit en cours…</p>
              <p className="text-xs text-violet-800/80 dark:text-violet-200/80">
                {meta.visionUsed
                  ? "Analyse photo + titre sur l’arbre Affisell"
                  : "Analyse du titre sur l’arbre Affisell"}
              </p>
            </div>
          </div>
        ) : awaitingConfirm && pendingConfirm ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">
              Catégorie proposée — validation requise
            </p>
            <p className="font-mono text-sm font-semibold leading-snug text-violet-950 dark:text-violet-50">
              {pendingConfirm.breadcrumb}
            </p>
            {pendingConfirm.reason ? (
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {pendingConfirm.reason}
              </p>
            ) : null}
            <p className="text-[11px] tabular-nums text-zinc-500">
              Confiance {confidencePct(pendingConfirm.confidence)}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                onClick={onConfirmPending}
              >
                <Check className="h-4 w-4" aria-hidden />
                Confirmer cette catégorie
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onDismissPending}
              >
                <X className="h-4 w-4" aria-hidden />
                Choisir moi-même
              </Button>
            </div>
          </div>
        ) : confirmed && pathLabel ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Catégorie validée
            </p>
            <p className="font-mono text-sm font-semibold leading-snug text-violet-950 dark:text-violet-50">
              {pathLabel}
            </p>
            {topSuggestion?.aiReason && categoryAiTag ? (
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {topSuggestion.aiReason}
              </p>
            ) : null}
            {topSuggestion?.confidence != null && categoryAiTag ? (
              <p className="text-[11px] tabular-nums text-emerald-700 dark:text-emerald-300">
                Confiance {confidencePct(topSuggestion.confidence)}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <p>
              Ajoutez une <strong>photo</strong> et un <strong>nom</strong> — une proposition de
              catégorie apparaîtra ici à confirmer.
            </p>
          </div>
        )}
      </div>

      {productInsight && !scanning && !awaitingConfirm ? (
        <p className="relative mt-2 text-[11px] text-violet-900/85 dark:text-violet-200/85">
          {productInsight.focusLabel}
        </p>
      ) : null}
    </div>
  )
}
