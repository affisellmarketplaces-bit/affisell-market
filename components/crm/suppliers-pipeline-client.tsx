"use client"

import { useMemo, useState } from "react"
import { ExternalLink, LayoutGrid, List } from "lucide-react"

import {
  PIPELINE_VIEW_FILTER_STATUSES,
  SUPPLIER_PIPELINE_KANBAN_STATUSES,
} from "@/lib/crm/supplier-pipeline-status"
import type { SupplierPipelineRow } from "@/lib/crm/supplier-pipeline-types"
import { cn } from "@/lib/utils"

type ViewMode = "kanban" | "pipeline"

type Props = {
  rows: SupplierPipelineRow[]
  notionConfigured: boolean
  notionDatabaseId: string | null
  fetchError: string | null
}

export function SuppliersPipelineClient({
  rows,
  notionConfigured,
  notionDatabaseId,
  fetchError,
}: Props) {
  const [view, setView] = useState<ViewMode>("kanban")

  const pipelineRows = useMemo(
    () => rows.filter((r) => PIPELINE_VIEW_FILTER_STATUSES.includes(r.status)),
    [rows]
  )

  const byStatus = useMemo(() => {
    const map = new Map<string, SupplierPipelineRow[]>()
    for (const status of SUPPLIER_PIPELINE_KANBAN_STATUSES) {
      map.set(status, [])
    }
    for (const row of rows) {
      const list = map.get(row.status) ?? []
      list.push(row)
      map.set(row.status, list)
    }
    return map
  }, [rows])

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            CRM fondateur
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">Suppliers Pipeline</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Source Notion — Kanban par statut ou liste Lead / Contacted. Push Python via API Notion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          {notionDatabaseId ? (
            <a
              href={`https://notion.so/${notionDatabaseId.replace(/-/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Ouvrir Notion
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      {!notionConfigured ? <SetupBanner /> : null}
      {fetchError ? <ErrorBanner code={fetchError} /> : null}

      {view === "kanban" ? (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
          {SUPPLIER_PIPELINE_KANBAN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              rows={byStatus.get(status) ?? []}
            />
          ))}
        </div>
      ) : (
        <PipelineTable rows={pipelineRows} className="mt-6" />
      )}

      <p className="mt-6 text-xs text-zinc-500">
        Template Notion : <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">docs/crm-notion-supplier-pipeline.md</code>
        {" · "}
        Script : <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">scripts/notion-crm-push-supplier.py</code>
      </p>
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
          view === "kanban"
            ? "bg-violet-600 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        )}
      >
        <LayoutGrid className="size-4" aria-hidden />
        Kanban
      </button>
      <button
        type="button"
        onClick={() => onChange("pipeline")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
          view === "pipeline"
            ? "bg-violet-600 text-white"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        )}
      >
        <List className="size-4" aria-hidden />
        Lead + Contacted
      </button>
    </div>
  )
}

function KanbanColumn({ status, rows }: { status: string; rows: SupplierPipelineRow[] }) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{status}</span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {rows.length}
        </span>
      </div>
      <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
        {rows.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-zinc-500">Aucune fiche</li>
        ) : (
          rows.map((row) => <SupplierCard key={row.id} row={row} compact />)
        )}
      </ul>
    </div>
  )
}

function PipelineTable({ rows, className }: { rows: SupplierPipelineRow[]; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80">
              {[
                "Name",
                "URL site",
                "SIRET",
                "Catégorie",
                "Telegram @",
                "Status",
                "Dernier contact",
                "Notes",
              ].map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  Aucun lead Contacted / Lead dans Notion.
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
                  <td className="px-3 py-2 font-medium">
                    <NotionNameLink row={row} />
                  </td>
                  <td className="px-3 py-2">
                    {row.siteUrl ? (
                      <a
                        href={row.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                      >
                        {truncate(row.siteUrl, 32)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.siret ?? "—"}</td>
                  <td className="px-3 py-2">{row.categorie ?? "—"}</td>
                  <td className="px-3 py-2">{row.telegram ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-xs">{formatDate(row.dernierContact)}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-zinc-600" title={row.notes ?? ""}>
                    {row.notes ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SupplierCard({ row, compact }: { row: SupplierPipelineRow; compact?: boolean }) {
  return (
    <li
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        compact && "text-sm"
      )}
    >
      <NotionNameLink row={row} />
      {row.categorie ? (
        <p className="mt-1 text-xs text-zinc-500">{row.categorie}</p>
      ) : null}
      {row.telegram ? (
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{row.telegram}</p>
      ) : null}
      {row.dernierContact ? (
        <p className="mt-1 text-xs text-zinc-500">Contact : {formatDate(row.dernierContact)}</p>
      ) : null}
    </li>
  )
}

function NotionNameLink({ row }: { row: SupplierPipelineRow }) {
  if (row.notionUrl) {
    return (
      <a
        href={row.notionUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-violet-700 hover:underline dark:text-violet-300"
      >
        {row.name}
      </a>
    )
  }
  return <span className="font-medium text-zinc-900 dark:text-white">{row.name}</span>
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200">
      {status}
    </span>
  )
}

function SetupBanner() {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">Notion non connecté</p>
      <p className="mt-1">
        Ajoute <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">NOTION_API_KEY</code> et{" "}
        <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">NOTION_CRM_DATABASE_ID</code> dans{" "}
        <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">.env.local</code>, puis duplique le
        template : fichier repo{" "}
        <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">docs/crm-notion-supplier-pipeline.md</code>.
      </p>
    </div>
  )
}

function ErrorBanner({ code }: { code: string }) {
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
      Erreur lecture Notion ({code}). Vérifie l&apos;intégration et les noms de colonnes du template.
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}
