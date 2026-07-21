"use client"

import { useEffect, useMemo, useState } from "react"

import {
  estimateBulkCatalogTotals,
  formatEnrichEuro,
  RADAR_BULK_IMPORT_MAX,
} from "@/lib/import/smart-import-enricher"
import type { RadarImportDestination } from "@/lib/radar/radar-import-types"

export type BulkModalWinner = {
  id: string
  title: string
}

type Props = {
  open: boolean
  country: string
  winners: BulkModalWinner[]
  defaultDestination: RadarImportDestination
  progress: { current: number; total: number } | null
  loading: boolean
  onClose: () => void
  onConfirm: (destination: RadarImportDestination) => void
}

export function RadarBulkImportModal({
  open,
  country,
  winners,
  defaultDestination,
  progress,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [destination, setDestination] = useState<RadarImportDestination>(defaultDestination)

  useEffect(() => {
    if (open) setDestination(defaultDestination)
  }, [open, defaultDestination])

  const capped = useMemo(() => winners.slice(0, RADAR_BULK_IMPORT_MAX), [winners])
  const totals = useMemo(() => estimateBulkCatalogTotals(capped), [capped])

  if (!open) return null

  const count = totals.count

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="radar-bulk-import-title"
      onClick={() => {
        if (!loading) onClose()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 id="radar-bulk-import-title" className="text-lg font-bold text-zinc-900">
            Importer {count} winners {country} ?
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Import bulk Radar → catalogue (max {RADAR_BULK_IMPORT_MAX})
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto px-5 py-3">
          <ul className="space-y-2">
            {totals.lines.map((line, i) => (
              <li
                key={`${capped[i]?.id ?? i}-${line.title}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="line-clamp-2 font-medium text-zinc-800">
                  {i + 1}. {line.title}
                </span>
                <span className="shrink-0 tabular-nums text-violet-700">
                  {formatEnrichEuro(line.salePrice)}€
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 border-t border-zinc-100 px-5 py-4">
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
            Total: Coût {formatEnrichEuro(totals.costTotal)}€ | Vente{" "}
            {formatEnrichEuro(totals.saleTotal)}€ | Marge +{formatEnrichEuro(totals.marginTotal)}€
            (x{totals.multiplier.toFixed(1)})
          </p>

          <label className="flex flex-col gap-1 text-xs text-zinc-600">
            <span className="font-semibold">Destination</span>
            <select
              value={destination}
              disabled={loading}
              onChange={(e) => setDestination(e.target.value as RadarImportDestination)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
            >
              <option value="affisell_catalog">Affisell Catalogue (draft)</option>
              <option value="supplier_draft">Supplier Draft</option>
            </select>
          </label>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={loading || count === 0}
              onClick={() => onConfirm(destination)}
              className="rounded-xl bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-60"
            >
              {loading && progress
                ? `Import en cours... ${progress.current}/${progress.total}`
                : `Confirmer — Importer ${count} produits`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
