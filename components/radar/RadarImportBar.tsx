"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { estimateBulkProfit, formatEnrichEuro } from "@/lib/import/smart-import-enricher"
import type { RadarImportDestination } from "@/lib/radar/radar-import-types"
import type { SupplierKind } from "@/lib/supplier-kind"

type Props = {
  selectedIds: string[]
  /** Live winner prices for selected rows (same order as selection not required). */
  selectedPrices: Array<number | null>
  country: string
  supplierKind: SupplierKind
  onClear: () => void
}

const DESTINATION_OPTIONS: Array<{ id: RadarImportDestination; label: string }> = [
  { id: "affisell_catalog", label: "Catalogue affilié (draft)" },
  { id: "supplier_draft", label: "Brouillon fournisseur" },
]

function defaultDestination(supplierKind: SupplierKind): RadarImportDestination {
  const isGrossiste = supplierKind === "stocker" || supplierKind === "unset"
  return isGrossiste ? "supplier_draft" : "affisell_catalog"
}

export function RadarImportBar({
  selectedIds,
  selectedPrices,
  country,
  supplierKind,
  onClear,
}: Props) {
  const [destination, setDestination] = useState<RadarImportDestination>(
    defaultDestination(supplierKind)
  )
  const [loading, setLoading] = useState(false)

  const count = selectedIds.length
  const visible = count > 0

  const marginEstimate = useMemo(() => estimateBulkProfit(selectedPrices), [selectedPrices])

  const importLabel = useMemo(() => {
    if (destination === "supplier_draft") {
      return `Importer en 1 clic → Brouillon fournisseur`
    }
    return `Importer en 1 clic → Catalogue`
  }, [destination])

  async function handleImport() {
    if (loading || count === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/radar/source", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerIds: selectedIds,
          country,
          destination,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        jobId?: string
        count?: number
        importedCount?: number
        redirectUrl?: string
      }

      if (!res.ok) {
        toast.error(data.error ?? "Import Radar impossible")
        return
      }

      const imported = data.importedCount ?? data.count ?? count

      if (destination === "supplier_draft" && data.redirectUrl) {
        toast.success(
          `${imported} produit${imported > 1 ? "s" : ""} prêt${imported > 1 ? "s" : ""} — ouverture assistant…`
        )
        onClear()
        window.location.href = data.redirectUrl
        return
      }

      toast.success(
        `${imported} produit${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""} en draft`,
        {
          action: {
            label: "Voir le catalogue",
            onClick: () => {
              window.location.href = "/dashboard/affiliate/catalog?filter=draft"
            },
          },
        }
      )
      onClear()
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

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-zinc-900">
              {count} produit{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
            </p>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="font-medium">Destination</span>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as RadarImportDestination)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800"
                disabled={loading}
              >
                {DESTINATION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              disabled={loading}
              className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Tout désélectionner
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? "Import…" : importLabel}
            </button>
            {destination === "affisell_catalog" ? (
              <Link
                href="/dashboard/affiliate/catalog?filter=draft"
                className="hidden text-xs font-medium text-violet-600 hover:text-violet-800 sm:inline"
              >
                Catalogue draft →
              </Link>
            ) : null}
          </div>
        </div>
        <p className="text-xs font-medium text-emerald-700">
          💰 Marge estimée: +{formatEnrichEuro(marginEstimate.profit)}€ (x
          {marginEstimate.multiplier.toFixed(1)}) sur {marginEstimate.count} produit
          {marginEstimate.count > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  )
}
