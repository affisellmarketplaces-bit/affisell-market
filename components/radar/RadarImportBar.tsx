"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  estimateBulkCatalogTotals,
  estimateBulkProfit,
  formatEnrichEuro,
  RADAR_BULK_IMPORT_MAX,
} from "@/lib/import/smart-import-enricher"
import { isRadarSupplierRole, radarBulkBarLabel } from "@/lib/radar/radar-copy"
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

const DESTINATION_OPTIONS: Array<{ id: RadarImportDestination; label: string }> = [
  { id: "affisell_catalog", label: "Catalogue affilié (draft)" },
  { id: "supplier_draft", label: "Brouillon fournisseur" },
]

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
      }),
    [userRole, bulkN, bulkMarginHint]
  )

  const importLabel = useMemo(() => {
    if (isRadarSupplierRole(userRole) || destination === "supplier_draft") {
      return `Proposer en 1 clic → Stock fournisseur`
    }
    return `Lister sans stock → Catalogue`
  }, [destination, userRole])

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
        toast.error(data.error ?? "Import Radar impossible")
        return
      }

      const imported = data.importedCount ?? data.count ?? count
      const margin = data.totalMargin ?? marginEstimate.profit
      const jobUrl =
        data.redirectUrl ?? (data.jobId ? `/dashboard/imports/${data.jobId}` : null)

      if (destination === "supplier_draft" && jobUrl) {
        toast.success(
          `🎉 ${imported} produit${imported > 1 ? "s" : ""} prêt${imported > 1 ? "s" : ""} — ouverture assistant…`
        )
        onClear()
        window.location.href = jobUrl
        return
      }

      toast.success(
        `🎉 ${imported} produits importés → Marge +${formatEnrichEuro(margin)}€`,
        {
          action: {
            label: "Voir arbitrage",
            onClick: () => {
              window.location.href = jobUrl ?? "/dashboard/affiliate/catalog?filter=draft"
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
      toast.error("Erreur réseau — réessayez")
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
                {count} produit{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-sm font-semibold text-zinc-900">
                {bulkN} winner{bulkN > 1 ? "s" : ""} visible{bulkN > 1 ? "s" : ""} — {country}
              </p>
            )}
            {hasSelection ? (
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="font-medium">Destination</span>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value as RadarImportDestination)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800"
                  disabled={busy}
                >
                  {DESTINATION_OPTIONS.map((opt) => (
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
                  Tout désélectionner
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                >
                  {loading ? "Import…" : importLabel}
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
                ? `Import en cours... ${bulkProgress.current}/${bulkProgress.total}`
                : bulkLabel}
            </button>
            {destination === "affisell_catalog" || !hasSelection ? (
              <Link
                href="/dashboard/affiliate/catalog?filter=draft"
                className="hidden text-xs font-medium text-violet-600 hover:text-violet-800 sm:inline"
              >
                Catalogue draft →
              </Link>
            ) : null}
          </div>
        </div>
        {hasSelection ? (
          <p className="text-xs font-medium text-emerald-700">
            💰 Marge estimée: +{formatEnrichEuro(marginEstimate.profit)}€ (x
            {marginEstimate.multiplier.toFixed(1)}) sur {marginEstimate.count} produit
            {marginEstimate.count > 1 ? "s" : ""}
          </p>
        ) : (
          <p className="text-xs font-medium text-emerald-700">
            💰 Marge estimée bulk: +{formatEnrichEuro(bulkMarginHint)}€ (x3.2) sur {bulkN} produits
          </p>
        )}
      </div>
    </div>
  )
}
