"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import type { CategoryCommissionRow } from "@/lib/admin/commission-rates/types"
import { affisellCommissionRateBpsToPercent } from "@/lib/affisell-platform-commission"
import { cn } from "@/lib/utils"

type Props = {
  initialRows: CategoryCommissionRow[]
  initialSearch: string
  initialLeafOnly: boolean
}

export function CategoryCommissionRatesClient({
  initialRows,
  initialSearch,
  initialLeafOnly,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState(initialSearch)
  const [leafOnly, setLeafOnly] = useState(initialLeafOnly)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [draftPercents, setDraftPercents] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialRows.map((r) => [
        r.id,
        r.affisellCommissionRateBps != null
          ? String(affisellCommissionRateBpsToPercent(r.affisellCommissionRateBps))
          : "",
      ])
    )
  )

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (leafOnly) params.set("leaf", "1")
    const qs = params.toString()
    router.push(qs ? `/admin/settings/commission-rates?${qs}` : "/admin/settings/commission-rates")
    router.refresh()
  }

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.productCount - a.productCount || a.fullPath.localeCompare(b.fullPath)),
    [rows]
  )

  async function saveRow(categoryId: string, inherit: boolean) {
    setSavingId(categoryId)
    try {
      const percentRaw = draftPercents[categoryId]?.trim()
      const body = inherit
        ? { inherit: true }
        : { commissionPercent: Number(percentRaw) }

      if (!inherit && (!percentRaw || Number.isNaN(Number(percentRaw)))) {
        return
      }

      const res = await fetch(`/api/admin/category-commission-rates/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        alert(j.error ?? "Save failed")
        return
      }
      const j = (await res.json()) as {
        category: { affisellCommissionRateBps: number | null }
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === categoryId
            ? {
                ...r,
                affisellCommissionRateBps: j.category.affisellCommissionRateBps,
                effectiveBps:
                  j.category.affisellCommissionRateBps ?? r.effectiveBps,
                effectivePercent: affisellCommissionRateBpsToPercent(
                  j.category.affisellCommissionRateBps ?? r.effectiveBps
                ),
              }
            : r
        )
      )
      if (inherit) {
        setDraftPercents((d) => ({ ...d, [categoryId]: "" }))
      }
      router.refresh()
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        onSubmit={(e) => {
          e.preventDefault()
          applyFilters()
        }}
      >
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Rechercher</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou chemin…"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={leafOnly}
            onChange={(e) => setLeafOnly(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Catégories feuilles uniquement
        </label>
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="px-3 py-2.5">Catégorie</th>
              <th className="px-3 py-2.5">Produits</th>
              <th className="px-3 py-2.5">Taux Affisell (%)</th>
              <th className="px-3 py-2.5">Effectif</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
              >
                <td className="max-w-xs px-3 py-2.5">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.name}</p>
                  <p className="truncate text-xs text-zinc-500">{row.fullPath}</p>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{row.productCount}</td>
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    placeholder="Hériter"
                    value={draftPercents[row.id] ?? ""}
                    onChange={(e) =>
                      setDraftPercents((d) => ({ ...d, [row.id]: e.target.value }))
                    }
                    className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                  {row.effectivePercent.toFixed(1)}%
                  {row.affisellCommissionRateBps == null ? (
                    <span className="ml-1 text-[10px] text-zinc-400">(hérité)</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void saveRow(row.id, false)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold text-white",
                        savingId === row.id ? "bg-zinc-400" : "bg-violet-600 hover:bg-violet-500"
                      )}
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void saveRow(row.id, true)}
                      className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-600"
                    >
                      Hériter
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">Aucune catégorie trouvée.</p>
        ) : null}
      </div>
    </div>
  )
}
