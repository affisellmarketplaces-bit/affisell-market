"use client"

import { Loader2, ScanLine, Sparkles } from "lucide-react"

import type { PendingCategoryConfirmation } from "@/components/supplier/supplier-category-confirm-types"
import type { CategoryPathSegment } from "@/lib/category-browse"
import { hasListingClassificationSignal } from "@/lib/supplier-auto-category-policy"
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
  suggestions: ListingCategorySuggestion[]
  topSuggestion: ListingCategorySuggestion | null
  productInsight: ListingProductInsight | null
  pendingConfirm: PendingCategoryConfirmation | null
  onSelectSuggestion: (suggestion: ListingCategorySuggestion) => void
  onDismissPending: () => void
}

function confidencePct(conf?: number) {
  if (conf == null || !Number.isFinite(conf)) return null
  return `${Math.round(conf * 100)} %`
}

function sourceLabel(src?: ListingCategorySuggestion["suggestionSource"]) {
  if (src === "catalog") return "Catalogue"
  if (src === "ai") return "Photo"
  if (src === "keyword") return "Mot-clé"
  return null
}

const MAX_SUGGESTIONS = 5

export function SupplierExpressTaxonomyRail({
  name,
  imageUrl,
  categoryPath,
  categoryId,
  categoryAiTag,
  loading,
  meta,
  suggestions,
  topSuggestion,
  productInsight,
  pendingConfirm,
  onSelectSuggestion,
  onDismissPending,
}: Props) {
  const pathLabel =
    categoryPath.length > 0
      ? categoryPath.map((s) => s.name).join(" › ")
      : topSuggestion?.breadcrumb ?? null

  const awaitingConfirm =
    pendingConfirm != null && categoryId !== pendingConfirm.leafId
  const confirmed = Boolean(categoryId && pathLabel && !awaitingConfirm)
  const readyToScan = hasListingClassificationSignal(name, imageUrl)
  const scanning = loading && readyToScan
  const recommendedLeafId = pendingConfirm?.leafId ?? topSuggestion?.leafId ?? null
  const visibleSuggestions = suggestions.slice(0, MAX_SUGGESTIONS)

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
          Catégories suggérées
        </span>
        {meta.visionUsed ? (
          <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
            Photo
          </span>
        ) : null}
        {awaitingConfirm ? (
          <span className="rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            À valider
          </span>
        ) : null}
        {categoryAiTag && confirmed ? (
          <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Confirmée
          </span>
        ) : null}
      </div>

      <p className="relative mt-2 text-xs leading-relaxed text-violet-900/90 dark:text-violet-200/90">
        Choisissez la catégorie qui correspond le mieux à votre article parmi les propositions ci-dessous.
      </p>

      <div className="relative mt-3 min-h-[3.5rem]">
        {scanning ? (
          <div className="flex items-center gap-3 text-sm text-violet-900 dark:text-violet-100">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600" aria-hidden />
            <div>
              <p className="font-medium">Analyse du produit en cours…</p>
              <p className="text-xs text-violet-800/80 dark:text-violet-200/80">
                {meta.visionUsed
                  ? "Analyse photo + titre sur l’arbre Affisell"
                  : "Analyse du titre sur l’arbre Affisell"}
              </p>
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
        ) : !readyToScan ? (
          <div className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <p>
              {name.trim().length < 3 && !imageUrl ? (
                <>
                  Saisissez le <strong>titre</strong> (3 car. min.), puis la <strong>photo</strong>{" "}
                  — les catégories proposées apparaîtront ici.
                </>
              ) : name.trim().length < 3 ? (
                <>Saisissez le <strong>titre</strong> du produit pour lancer l’analyse.</>
              ) : (
                <>Ajoutez la <strong>photo principale</strong> pour lancer l’analyse.</>
              )}
            </p>
          </div>
        ) : visibleSuggestions.length > 0 ? (
          <ul className="space-y-2">
            {visibleSuggestions.map((lp, i) => {
              const badge = sourceLabel(lp.suggestionSource)
              const isRecommended = lp.leafId === recommendedLeafId
              const isSelected = categoryId === lp.leafId
              return (
                <li
                  key={lp.leafId}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between",
                    isSelected
                      ? "border-violet-400 bg-violet-100/90 dark:border-violet-600 dark:bg-violet-900/40"
                      : isRecommended
                        ? "border-amber-300/80 bg-amber-50/90 ring-1 ring-amber-400/40 dark:border-amber-800/60 dark:bg-amber-950/30"
                        : "border-violet-100/90 bg-white/95 dark:border-violet-900/50 dark:bg-zinc-950/80"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-violet-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        {i + 1}
                      </span>
                      {isRecommended ? (
                        <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                          Recommandée
                        </span>
                      ) : null}
                      {badge ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-900/60 dark:text-violet-200">
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium leading-snug text-zinc-800 dark:text-zinc-200">
                      {lp.breadcrumb}
                    </p>
                    {lp.aiReason ? (
                      <p className="mt-1 text-[10px] leading-snug text-violet-800/75 dark:text-violet-300/80">
                        {lp.aiReason}
                      </p>
                    ) : null}
                    {lp.confidence != null ? (
                      <p className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
                        Confiance {confidencePct(lp.confidence)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    className={cn(
                      "shrink-0 gap-1",
                      !isSelected && "bg-violet-600 hover:bg-violet-700"
                    )}
                    disabled={isSelected}
                    onClick={() => onSelectSuggestion(lp)}
                  >
                    {isSelected ? "Sélectionnée" : "Choisir"}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">Analyse titre + photo en cours de préparation…</p>
        )}
      </div>

      {visibleSuggestions.length > 0 && !scanning && !confirmed ? (
        <button
          type="button"
          className="relative mt-3 text-[11px] font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
          onClick={onDismissPending}
        >
          Aucune ne convient — parcourir l’arbre catalogue plus bas
        </button>
      ) : null}

      {productInsight && !scanning && !confirmed ? (
        <p className="relative mt-2 text-[11px] text-violet-900/85 dark:text-violet-200/85">
          {productInsight.focusLabel}
        </p>
      ) : null}
    </div>
  )
}
