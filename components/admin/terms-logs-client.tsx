"use client"

import { Download } from "lucide-react"

import { buildTermsLogsCsv } from "@/lib/admin/terms-logs/build-terms-logs-csv"
import type { AdminTermsLogRow } from "@/lib/admin/terms-logs/types"
import { TERMS_LOGS_CSV_COLUMNS, TERMS_LOGS_CSV_FILENAME } from "@/lib/admin/terms-logs/types"
import { cn } from "@/lib/utils"

type Props = {
  rows: AdminTermsLogRow[]
  totalLoaded: number
}

const COLUMN_LABELS: Record<(typeof TERMS_LOGS_CSV_COLUMNS)[number], string> = {
  userId: "User ID",
  email: "Email",
  type: "Type",
  version: "Version",
  ip: "IP",
  userAgent: "User-Agent",
  createdAt: "Date",
}

export function TermsLogsClient({ rows, totalLoaded }: Props) {
  function downloadCsv() {
    const csv = buildTermsLogsCsv(rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = TERMS_LOGS_CSV_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
    console.log("[terms-logs]", { result: "csv_export", rows: rows.length })
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Preuve art. 1366 C. civ.
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            Journal des acceptations CGU / CGA / CGS
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {totalLoaded} entrée{totalLoaded > 1 ? "s" : ""} chargée{totalLoaded > 1 ? "s" : ""} (IP +
            user-agent horodatés). Export CSV pour audit DGCCRF / CNIL.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-300 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-700"
          )}
        >
          <Download className="size-4" aria-hidden />
          Exporter CSV
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80">
                {TERMS_LOGS_CSV_COLUMNS.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
                  >
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={TERMS_LOGS_CSV_COLUMNS.length}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    Aucune acceptation enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-zinc-100 dark:border-zinc-800",
                      i % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-950/40"
                    )}
                  >
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {row.userId}
                    </td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{row.email}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.type}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      {row.version}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {row.ip}
                    </td>
                    <td
                      className="max-w-[280px] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400"
                      title={row.userAgent}
                    >
                      {row.userAgent}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.createdAt}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
