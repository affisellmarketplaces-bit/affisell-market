"use client"

import Link from "next/link"

import { ArbitrageBadgeCompact } from "@/components/import/ArbitrageBadge"
import { formatEnrichEuro } from "@/lib/import/smart-import-enricher"

export type RadarDraftArbitrageRow = {
  id: string
  title: string
  imageUrl: string | null
  costPrice: number
  salePrice: number
  margin: number
  multiplier: number
  score: number
  sourceCountry: string
}

type Props = {
  rows: RadarDraftArbitrageRow[]
}

/**
 * Additive catalog panel — Radar drafts with arbitrage column (filter=draft).
 */
export function RadarCatalogArbitragePanel({ rows }: Props) {
  if (rows.length === 0) return null

  return (
    <section className="mx-auto mb-8 max-w-7xl px-4 md:px-8">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900/40 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/40">
          <div>
            <h2 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
              Drafts Radar — colonne Arbitrage
            </h2>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/70">
              {rows.length} import{rows.length > 1 ? "s" : ""} World Radar · pricing x3.2
            </p>
          </div>
          <Link
            href="/radar?country=FR"
            className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
          >
            Retour Radar →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2">Arbitrage</th>
                <th className="px-3 py-2">Vente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-50 dark:border-zinc-900">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" className="size-8 rounded object-cover" />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded bg-zinc-100 text-xs">
                          📦
                        </span>
                      )}
                      <span className="line-clamp-2 max-w-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {r.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ArbitrageBadgeCompact
                      multiplier={r.multiplier}
                      margin={r.margin}
                      tooltip={`Acheté ${formatEnrichEuro(r.costPrice)}€ en CN → Vendu ${formatEnrichEuro(r.salePrice)}€ en ${r.sourceCountry} = +${formatEnrichEuro(r.margin)}€ | Score ${r.score}/100`}
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {formatEnrichEuro(r.salePrice)}€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
