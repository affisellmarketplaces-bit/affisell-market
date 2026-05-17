"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, Database, Loader2, Sparkles, Terminal, X } from "lucide-react"

import { CategoryAutocomplete } from "@/components/supplier/category-autocomplete"
import { Button } from "@/components/ui/button"
import type {
  BrowseNode,
  CategoryPathSegment,
  LeafPath,
  RecentCategoryEntry,
} from "@/lib/category-browse"
import { cn } from "@/lib/utils"

export type BrowsePayload = {
  nodes: Record<string, BrowseNode>
  rootIds: string[]
  childrenByParent: Record<string, string[]>
  leafPaths: LeafPath[]
}

export type CategoryPickOrigin = "manual" | "suggested"

type Props = {
  browse: BrowsePayload | null
  recent: RecentCategoryEntry[]
  value: string
  onChange: (leafId: string, path: CategoryPathSegment[], origin?: CategoryPickOrigin) => void
  /** Merged Groq + keyword suggestions (max 3). */
  suggestions: LeafPath[]
  suggestionsLoading?: boolean
  loading?: boolean
}

function breadcrumbFromPath(path: CategoryPathSegment[]) {
  return path.map((p) => p.name).join(" > ")
}

export function SupplierCategoryPicker({
  browse,
  recent,
  value,
  onChange,
  suggestions,
  suggestionsLoading,
  loading,
}: Props) {
  const [showRecentBox, setShowRecentBox] = useState(true)
  const [chain, setChain] = useState<string[]>([])

  const pathForChain = useCallback(
    (ids: string[]): CategoryPathSegment[] | null => {
      if (!browse) return null
      const out: CategoryPathSegment[] = []
      for (const id of ids) {
        const n = browse.nodes[id]
        if (!n) return null
        out.push({ id: n.id, name: n.name })
      }
      return out
    },
    [browse]
  )

  useEffect(() => {
    if (!browse) return
    if (!value) {
      setChain([])
      return
    }
    const walk: string[] = []
    let cur: string | undefined = value
    const seen = new Set<string>()
    while (cur && browse.nodes[cur]) {
      if (seen.has(cur)) break
      seen.add(cur)
      walk.push(cur)
      cur = browse.nodes[cur].parentId ?? undefined
    }
    walk.reverse()
    if (walk.length) setChain(walk)
  }, [browse, value])

  /** One column per tree level (Google taxonomy up to 7 levels). */
  const drillColumns = useMemo(() => {
    if (!browse) return [] as string[][]
    const cols: string[][] = [browse.rootIds]
    for (let i = 0; i < chain.length; i++) {
      const parentId = chain[i]
      if (!parentId) break
      cols.push(browse.childrenByParent[parentId] ?? [])
    }
    return cols
  }, [browse, chain])

  const onColumnPick = useCallback(
    (colIdx: number, id: string) => {
      if (!browse) return
      const nextChain = [...chain.slice(0, colIdx), id]
      setChain(nextChain)
      const kids = browse.childrenByParent[id] ?? []
      if (kids.length > 0) return
      const path = pathForChain(nextChain)
      if (path) onChange(id, path, "manual")
    },
    [browse, chain, pathForChain, onChange]
  )

  const breadcrumbTrail = useMemo(() => {
    if (!browse || chain.length === 0) return "Toutes les catégories"
    const parts = chain.map((id) => browse.nodes[id]?.name ?? id)
    return ["Toutes les catégories", ...parts].join(" > ")
  }, [browse, chain])

  const applyLeaf = (
    lp: LeafPath | RecentCategoryEntry,
    origin: CategoryPickOrigin = "manual"
  ) => {
    const path = lp.path
    onChange(lp.leafId, path, origin)
    setChain(path.map((s) => s.id))
  }

  if (loading || !browse) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        Chargement des catégories…
      </div>
    )
  }

  if (browse.rootIds.length === 0) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-violet-50/35 p-5 shadow-md ring-1 ring-amber-500/[0.08] dark:border-amber-900/45 dark:from-amber-950/25 dark:via-zinc-950 dark:to-violet-950/20 dark:ring-amber-400/10 sm:p-6"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/15" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-200/80 dark:from-amber-950/80 dark:to-amber-900/40 dark:text-amber-100 dark:ring-amber-800/60">
            <Database className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Taxonomie non chargée
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Exécutez le seed des catégories depuis la racine du projet (
                <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  DATABASE_URL
                </code>
                ).
              </p>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-100 dark:border-zinc-700">
              <Terminal className="mb-1 inline h-3.5 w-3.5 opacity-70" aria-hidden /> npx prisma db seed
            </pre>
          </div>
        </div>
      </div>
    )
  }

  const showSuggestions = suggestionsLoading || suggestions.length > 0

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Catégorie sélectionnée
        </p>
        <CategoryAutocomplete
          browse={browse}
          value={value}
          disabled={loading}
          placeholder="Rechercher dans la taxonomie Google (FR)…"
          onChange={(leafId, path) => onChange(leafId, path, "manual")}
        />
      </div>

      {showSuggestions ? (
        <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/80 p-4 dark:border-violet-900/60 dark:from-violet-950/40 dark:to-indigo-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            Catégories suggérées
          </div>
          <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/80">
            D’après le titre et la description — la meilleure correspondance est appliquée automatiquement.
          </p>
          {suggestionsLoading ? (
            <ul className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-violet-100/80 bg-white/60 px-3 py-3 dark:border-violet-900/40 dark:bg-zinc-950/50"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
                  <span className="text-xs text-violet-800/70 dark:text-violet-200/70">Analyse en cours…</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 space-y-2">
              {suggestions.map((lp, i) => (
                <li
                  key={lp.leafId}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs",
                    value === lp.leafId
                      ? "border-violet-400 bg-violet-100/90 dark:border-violet-600 dark:bg-violet-900/40"
                      : "border-violet-100 bg-white/90 dark:border-violet-900/50 dark:bg-zinc-950/80"
                  )}
                >
                  <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">
                    {i === 0 ? (
                      <span className="mr-1.5 rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Recommandé
                      </span>
                    ) : null}
                    {lp.breadcrumb}
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant={value === lp.leafId ? "secondary" : "outline"}
                    className="shrink-0"
                    disabled={value === lp.leafId}
                    onClick={() => applyLeaf(lp, "suggested")}
                  >
                    {value === lp.leafId ? "Appliquée" : "Appliquer"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showRecentBox && recent.length > 0 ? (
        <div className="relative rounded-lg border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <button
            type="button"
            className="absolute right-2 top-2 rounded p-1 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => setShowRecentBox(false)}
            aria-label="Masquer les catégories récentes"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="pr-8 text-sm font-medium text-zinc-800 dark:text-zinc-100">Récemment utilisées</p>
          <ul className="mt-3 space-y-2">
            {recent.map((r) => (
              <li
                key={r.leafId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              >
                <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">
                  {breadcrumbFromPath(r.path)}
                </span>
                <Button type="button" size="xs" variant="outline" className="shrink-0" onClick={() => applyLeaf(r)}>
                  Appliquer
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Parcourir l’arbre
        </p>
        <p
          className="truncate rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
          title={breadcrumbTrail}
        >
          {breadcrumbTrail}
        </p>
        <div className="mt-1.5 flex w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
          {drillColumns.map((ids, colIdx) => {
            return (
              <div
                key={colIdx}
                className="min-w-[11rem] max-w-[14rem] shrink-0 border-r border-zinc-200 last:border-r-0 dark:border-zinc-800"
              >
                <p className="border-b border-zinc-100 bg-zinc-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                  Niveau {colIdx + 1}
                </p>
                <ul className="max-h-[min(42vh,14rem)] min-h-[7rem] overflow-y-auto py-0.5">
                  {ids.length === 0 ? (
                    <li className="px-2 py-4 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                      {colIdx === 0 ? "Aucune catégorie" : "—"}
                    </li>
                  ) : (
                    ids.map((id) => {
                      const n = browse.nodes[id]
                      if (!n) return null
                      const child = Boolean(browse.childrenByParent[id]?.length)
                      const selectedInCol = chain[colIdx] === id
                      const isCommitted = value === id
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            title={n.name}
                            className={cn(
                              "flex w-full items-start justify-between gap-1.5 px-2 py-1.5 text-left text-xs leading-snug transition",
                              selectedInCol || isCommitted
                                ? "bg-violet-100 text-violet-950 dark:bg-violet-900/50 dark:text-violet-50"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            )}
                            onClick={() => onColumnPick(colIdx, id)}
                          >
                            <span className="min-w-0 flex-1 break-words text-left">
                              {n.icon ? <span className="mr-0.5">{n.icon}</span> : null}
                              {n.name}
                            </span>
                            {child ? (
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                            ) : null}
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {value && browse.nodes[value] ? (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Catégorie feuille appliquée — les champs spécifiques se chargent ci-dessous.
        </p>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Choisissez une suggestion, recherchez ou parcourez l’arbre jusqu’à une catégorie feuille.
        </p>
      )}
    </div>
  )
}
