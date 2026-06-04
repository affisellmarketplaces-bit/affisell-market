"use client"

import { Download } from "lucide-react"

import {
  RGPD_REGISTRE_COLUMNS,
  RGPD_REGISTRE_FILENAME,
  RGPD_REGISTRE_ROWS,
  buildRgpdRegistreCsv,
  type RgpdRegistreRow,
} from "@/lib/admin/rgpd-registre-data"
import { cn } from "@/lib/utils"

type Props = {
  rows: RgpdRegistreRow[]
  lastUpdated: string
}

export function RgpdRegistreClient({ rows, lastUpdated }: Props) {
  function downloadCsv() {
    const csv = buildRgpdRegistreCsv(rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = RGPD_REGISTRE_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
    console.log("[rgpd-registre]", { result: "csv_export", rows: rows.length })
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Conformité RGPD
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            Registre des activités de traitement
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Art. 30 RGPD — document interne admin. Dernière révision : {lastUpdated}. Export CSV pour
            archivage ou échange avec la CNIL.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-300 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 dark:border-violet-700"
          )}
        >
          <Download className="size-4" aria-hidden />
          Exporter CSV (CNIL)
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80">
                {RGPD_REGISTRE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.finalite}
                  className={cn(
                    "border-b border-zinc-100 dark:border-zinc-800",
                    i % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-950/40"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {row.finalite}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.baseLegale}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.donnees}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.duree}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.destinataires}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.transfertHorsUe}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.mesuresSecurite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
        Séparateur CSV : point-virgule (;) · encodage UTF-8 avec BOM. Compléter ce registre lors de tout
        nouveau sous-traitant ou finalité.
      </p>
    </div>
  )
}
