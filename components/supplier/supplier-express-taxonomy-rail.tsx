"use client"

import { ChevronRight, Loader2, ScanLine, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import type { PendingCategoryConfirmation } from "@/components/supplier/supplier-category-confirm-types"
import type { CategoryPathSegment } from "@/lib/category-browse"
import { hasListingClassificationSignal, isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"
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
  onBrowseCatalogManually: () => void
}

function confidencePct(conf?: number) {
  if (conf == null || !Number.isFinite(conf)) return null
  return `${Math.round(conf * 100)} %`
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
  onBrowseCatalogManually,
}: Props) {
  const t = useTranslations("supplier.expressTaxonomy")

  const sourceLabel = (src?: ListingCategorySuggestion["suggestionSource"]) => {
    if (src === "catalog") return t("sourceCatalog")
    if (src === "ai") return t("sourceAi")
    if (src === "keyword") return t("sourceKeyword")
    return null
  }

  const pathLabel =
    categoryPath.length > 0
      ? categoryPath.map((s) => s.name).join(" › ")
      : topSuggestion?.breadcrumb ?? null

  const awaitingConfirm =
    pendingConfirm != null && categoryId !== pendingConfirm.leafId
  const confirmed = Boolean(categoryId && pathLabel && !awaitingConfirm)
  const durableImage = isDurableListingImageUrl(imageUrl) ? imageUrl!.trim() : null
  const photoUploadPending = Boolean(imageUrl?.trim() && !durableImage)
  const readyToScan = hasListingClassificationSignal(name, durableImage)
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
          {t("badge")}
        </span>
        {meta.visionUsed ? (
          <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
            {t("photoBadge")}
          </span>
        ) : null}
        {awaitingConfirm ? (
          <span className="rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            {t("pendingBadge")}
          </span>
        ) : null}
        {categoryAiTag && confirmed ? (
          <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {t("confirmedBadge")}
          </span>
        ) : null}
      </div>

      <p className="relative mt-2 text-xs leading-relaxed text-violet-900/90 dark:text-violet-200/90">
        {t("chooseHint")}
      </p>

      <div className="relative mt-3 min-h-[3.5rem]">
        {scanning ? (
          <div className="flex items-center gap-3 text-sm text-violet-900 dark:text-violet-100">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600" aria-hidden />
            <div>
              <p className="font-medium">{t("analyzingTitle")}</p>
              <p className="text-xs text-violet-800/80 dark:text-violet-200/80">
                {meta.visionUsed ? t("analyzingVision") : t("analyzingTitleOnly")}
              </p>
            </div>
          </div>
        ) : confirmed && pathLabel ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              {t("validatedLabel")}
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
                {t("confidence", { pct: confidencePct(topSuggestion.confidence) ?? "" })}
              </p>
            ) : null}
          </div>
        ) : !readyToScan ? (
          <div className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <p>
              {photoUploadPending && name.trim().length >= 3
                ? t("photoUploadPending")
                : name.trim().length < 3 && !durableImage
                  ? t("emptyBoth", {
                      title: t("titleWord"),
                      photo: t("photoWord"),
                    })
                  : name.trim().length < 3
                    ? t("emptyTitle", { title: t("titleWord") })
                    : t("emptyPhoto", { mainPhoto: t("mainPhotoWord") })}
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
                          {t("recommended")}
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
                        {t("confidence", { pct: confidencePct(lp.confidence) ?? "" })}
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
                    {isSelected ? t("selected") : t("select")}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t("noSuggestions")}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("noSuggestionsHint")}</p>
          </div>
        )}
      </div>

      {!scanning && readyToScan ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative mt-3 w-full justify-between gap-2 rounded-xl border-violet-300/80 bg-white/90 text-left text-xs font-semibold text-violet-800 shadow-sm hover:border-violet-400 hover:bg-violet-50 dark:border-violet-700 dark:bg-zinc-950/80 dark:text-violet-100 dark:hover:bg-violet-950/50"
          onClick={onBrowseCatalogManually}
        >
          <span>{confirmed ? t("editCategory") : t("browseManualAlt")}</span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        </Button>
      ) : null}

      {productInsight && !scanning && !confirmed ? (
        <p className="relative mt-2 text-[11px] text-violet-900/85 dark:text-violet-200/85">
          {productInsight.focusLabel}
        </p>
      ) : null}
    </div>
  )
}
