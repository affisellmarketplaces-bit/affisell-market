"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  estimateBulkCatalogTotals,
  estimateBulkProfit,
  formatEnrichEuro,
  RADAR_BULK_IMPORT_MAX,
} from "@/lib/import/smart-import-enricher"
import type { AppLocale } from "@/lib/i18n-locale"
import { isRadarSupplierRole, radarBulkBarLabel } from "@/lib/radar/radar-copy"
import { canViewResellerMargin } from "@/lib/radar/radar-price-veil"
import type { RadarImportDestination } from "@/lib/radar/radar-import-types"
import type { SupplierKind } from "@/lib/supplier-kind"

type Props = {
  selectedIds: string[]
  /** Live winner prices for selected rows. */
  selectedPrices: Array<number | null>
  country: string
  supplierKind: SupplierKind
  userRole?: string | null
  visibleCount: number
  onClear: () => void
  onOpenBulk: () => void
  bulkProgress: { current: number; total: number } | null
  bulkLoading: boolean
}

function destinationOptionsForRole(
  userRole: string | null | undefined,
  t: (key: string) => string
): Array<{ id: RadarImportDestination; label: string }> {
  const all: Array<{ id: RadarImportDestination; label: string }> = [
    { id: "affisell_catalog", label: t("destAffiliateCatalog") },
    { id: "supplier_draft", label: t("destSupplierDraftShort") },
  ]
  if (isRadarSupplierRole(userRole)) return all.filter((o) => o.id === "supplier_draft")
  return all
}

function defaultDestination(
  supplierKind: SupplierKind,
  userRole?: string | null
): RadarImportDestination {
  if (isRadarSupplierRole(userRole) || supplierKind === "stocker") return "supplier_draft"
  return "affisell_catalog"
}

export function RadarImportBar({
  selectedIds,
  selectedPrices,
  country,
  supplierKind,
  userRole,
  visibleCount,
  onClear,
  onOpenBulk,
  bulkProgress,
  bulkLoading,
}: Props) {
  const t = useTranslations("radarTerminal")
  const locale = useLocale() as AppLocale
  const [destination, setDestination] = useState<RadarImportDestination>(
    defaultDestination(supplierKind, userRole)
  )
  const [loading, setLoading] = useState(false)

  const count = selectedIds.length
  const bulkN = Math.min(visibleCount, RADAR_BULK_IMPORT_MAX)
  const hasSelection = count > 0

  const marginEstimate = useMemo(() => estimateBulkProfit(selectedPrices), [selectedPrices])

  const bulkMarginHint = useMemo(() => {
    const totals = estimateBulkCatalogTotals(
      Array.from({ length: bulkN }, (_, i) => ({ title: `w${i}` }))
    )
    return totals.marginTotal
  }, [bulkN])

  const bulkLabel = useMemo(
    () =>
      radarBulkBarLabel({
        role: userRole,
        count: bulkN,
        marginEuro: bulkMarginHint,
        locale,
      }),
    [userRole, bulkN, bulkMarginHint, locale]
  )

  const importLabel = useMemo(() => {
    if (isRadarSupplierRole(userRole) || destination === "supplier_draft") {
      return t("importOneClickSupplier")
    }
    return t("importListCatalog")
  }, [destination, userRole, t])

  async function handleImport() {
    if (loading || bulkLoading || count === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/radar/source", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerIds: selectedIds.slice(0, RADAR_BULK_IMPORT_MAX),
          country,
          destination,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        jobId?: string
        count?: number
        importedCount?: number
        totalMargin?: number
        redirectUrl?: string
      }

      if (!res.ok) {
        toast.error(data.error ?? t("toastRadarImportFailed"))
        return
      }

      const imported = data.importedCount ?? data.count ?? count
      const margin = data.totalMargin ?? marginEstimate.profit
      const jobUrl =
        data.redirectUrl ?? (data.jobId ? `/dashboard/imports/${data.jobId}` : null)

      if (destination === "supplier_draft" && jobUrl) {
        toast.success(t("toastReadySupplier", { n: imported }))
        onClear()
        window.location.href = jobUrl
        return
      }

      toast.success(
        canViewResellerMargin(userRole)
          ? t("toastImportedReseller", { n: imported, margin: formatEnrichEuro(margin) })
          : t("toastImportedSupplier", { n: imported }),
        {
          action: {
            label: canViewResellerMargin(userRole) ? t("viewArbitrage") : t("viewDrafts"),
            onClick: () => {
              window.location.href =
                jobUrl ??
                (canViewResellerMargin(userRole)
                  ? "/dashboard/affiliate/catalog?filter=draft"
                  : "/dashboard/supplier/products")
            },
          },
        }
      )
      onClear()
      if (jobUrl && destination === "affisell_catalog") {
        window.setTimeout(() => {
          window.location.href = jobUrl
        }, 600)
      }
    } catch (err) {
      console.error("[RadarImportBar]", {
        result: "error",
        message: err instanceof Error ? err.message : "unknown",
      })
      toast.error(t("toastNetworkRetry"))
    } finally {
      setLoading(false)
    }
  }

  if (bulkN === 0 && !hasSelection) return null

  const busy = loading || bulkLoading

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {hasSelection ? (
              <p className="text-sm font-semibold text-zinc-900">
                {t("selectedCount", { count })}
              </p>
            ) : (
              <p className="text-sm font-semibold text-zinc-900">
                {t("visibleCount", { count: bulkN, country })}
              </p>
            )}
            {hasSelection ? (
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="font-medium">{t("destination")}</span>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value as RadarImportDestination)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800"
                  disabled={busy}
                >
                  {destinationOptionsForRole(userRole, t).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasSelection ? (
              <>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={busy}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  {t("clearAll")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                >
                  {loading ? t("importingShort") : importLabel}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onOpenBulk}
              disabled={busy || bulkN === 0}
              className="inline-flex items-center gap-1 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#5B21B6] disabled:opacity-60"
            >
              {bulkLoading && bulkProgress
                ? t("importing", { current: bulkProgress.current, total: bulkProgress.total })
                : bulkLabel}
            </button>
            {destination === "affisell_catalog" || !hasSelection ? (
              canViewResellerMargin(userRole) ? (
                <Link
                  href="/dashboard/affiliate/catalog?filter=draft"
                  className="hidden text-xs font-medium text-violet-600 hover:text-violet-800 sm:inline"
                >
                  {t("catalogDraftLink")}
                </Link>
              ) : (
                <Link
                  href="/dashboard/supplier/products"
                  className="hidden text-xs font-medium text-violet-600 hover:text-violet-800 sm:inline"
                >
                  {t("myDrafts")}
                </Link>
              )
            ) : null}
          </div>
        </div>
        {canViewResellerMargin(userRole) ? (
          hasSelection ? (
            <p className="text-xs font-medium text-emerald-700">
              {t("marginEst", {
                margin: formatEnrichEuro(marginEstimate.profit),
                mult: marginEstimate.multiplier.toFixed(1),
                count: marginEstimate.count,
              })}
            </p>
          ) : (
            <p className="text-xs font-medium text-emerald-700">
              {t("marginEstBulk", { margin: formatEnrichEuro(bulkMarginHint), count: bulkN })}
            </p>
          )
        ) : (
          <p className="text-xs font-medium text-violet-700">
            {t("supplierBar", { count: bulkN })}
          </p>
        )}
      </div>
    </div>
  )
}
