"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, Database, Loader2, Search, Sparkles, Terminal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type Props = {
  browse: BrowsePayload | null
  recent: RecentCategoryEntry[]
  value: string
  onChange: (leafId: string, path: CategoryPathSegment[]) => void
  /** Keyword / lexical matches from title (always local). */
  keywordSuggestions: LeafPath[]
  /** Groq-ranked picks from live taxonomy (may be empty). */
  aiSuggestions: LeafPath[]
  aiLoading?: boolean
  loading?: boolean
}

function breadcrumbFromPath(path: CategoryPathSegment[]) {
  return path.map((p) => p.name).join(" > ")
}

function dedupeByLeaf(primary: LeafPath[], secondary: LeafPath[]): LeafPath[] {
  const seen = new Set(primary.map((p) => p.leafId))
  const out = [...primary]
  for (const lp of secondary) {
    if (out.length >= 3) break
    if (!seen.has(lp.leafId)) {
      seen.add(lp.leafId)
      out.push(lp)
    }
  }
  return out.slice(0, 3)
}

export function SupplierCategoryPicker({
  browse,
  recent,
  value,
  onChange,
  keywordSuggestions,
  aiSuggestions,
  aiLoading,
  loading,
}: Props) {
  const [search, setSearch] = useState("")
  const [showRecentBox, setShowRecentBox] = useState(true)
  const [chain, setChain] = useState<string[]>([])
  const [columnPending, setColumnPending] = useState<{
    leafId: string
    path: CategoryPathSegment[]
  } | null>(null)

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
      setColumnPending(null)
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
    if (walk.length) {
      setChain(walk)
      setColumnPending(null)
    }
  }, [browse, value])

  const searchHits = useMemo(() => {
    if (!browse || !search.trim()) return []
    const q = search.trim().toLowerCase()
    return browse.leafPaths
      .filter((lp) => lp.breadcrumb.toLowerCase().includes(q))
      .slice(0, 50)
  }, [browse, search])

  /** Three fixed columns for root → mid → leaf (taxonomy depth 3). */
  const threeCols = useMemo(() => {
    if (!browse) return [[], [], []] as [string[], string[], string[]]
    const c0 = browse.rootIds
    const c1 = chain[0] ? browse.childrenByParent[chain[0]] ?? [] : []
    const c2 = chain[1] ? browse.childrenByParent[chain[1]] ?? [] : []
    return [c0, c1, c2]
  }, [browse, chain])

  /** Hide empty drill-down columns so the active column gets more width and names wrap better. */
  const visibleColumnCount = chain.length <= 0 ? 1 : chain.length === 1 ? 2 : 3

  const onColumnPick = useCallback(
    (colIdx: 0 | 1 | 2, id: string) => {
      if (!browse) return
      const child = Boolean(browse.childrenByParent[id]?.length)
      if (colIdx === 0) {
        setChain([id])
        setColumnPending(null)
        return
      }
      if (colIdx === 1) {
        const r0 = chain[0]
        if (!r0) return
        setChain([r0, id])
        setColumnPending(null)
        return
      }
      const r0 = chain[0]
      const r1 = chain[1]
      if (!r0 || !r1) return
      const next = [r0, r1, id]
      const path = pathForChain(next)
      setChain(next)
      if (child) {
        setColumnPending(null)
      } else if (path) {
        setColumnPending({ leafId: id, path })
      }
    },
    [browse, chain, pathForChain]
  )

  const breadcrumbTrail = useMemo(() => {
    if (!browse || chain.length === 0) return "All categories"
    const parts = chain.map((id) => browse.nodes[id]?.name ?? id)
    return ["All categories", ...parts].join(" > ")
  }, [browse, chain])

  const keywordOnly = useMemo(() => {
    const aiIds = new Set(aiSuggestions.map((a) => a.leafId))
    const filtered = keywordSuggestions.filter((k) => !aiIds.has(k.leafId))
    return dedupeByLeaf([], filtered)
  }, [keywordSuggestions, aiSuggestions])

  const applyLeaf = (lp: LeafPath | RecentCategoryEntry) => {
    setColumnPending(null)
    onChange(lp.leafId, "breadcrumb" in lp ? lp.path : lp.path)
    setChain(lp.path.map((s) => s.id))
  }

  if (loading || !browse) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        Loading categories…
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
                Category taxonomy not loaded
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                This environment has no marketplace categories yet. Run a one-time seed from the project root (uses
                your{" "}
                <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  DATABASE_URL
                </code>
                ), then refresh this page.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200/90 bg-white/90 p-3.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <Terminal className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Prisma
                </span>
                <code className="mt-2 block break-all font-mono text-[13px] font-medium text-violet-700 dark:text-violet-300">
                  npx prisma db seed
                </code>
              </div>
              <div className="rounded-xl border border-zinc-200/90 bg-white/90 p-3.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  npm script
                </span>
                <code className="mt-2 block font-mono text-[13px] font-medium text-violet-700 dark:text-violet-300">
                  npm run seed
                </code>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              After seeding you get the full tree, AI category hints, and aisle-specific specs on this form.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showRecentBox && recent.length > 0 ? (
        <div className="relative rounded-lg border border-violet-200 bg-violet-50/90 p-4 dark:border-violet-900 dark:bg-violet-950/40">
          <button
            type="button"
            className="absolute right-2 top-2 rounded p-1 text-violet-700 hover:bg-violet-100 dark:text-violet-200 dark:hover:bg-violet-900/60"
            onClick={() => setShowRecentBox(false)}
            aria-label="Dismiss previously used categories"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 pr-8 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            Previously used categories
          </div>
          <ul className="mt-3 space-y-2">
            {recent.map((r) => (
              <li
                key={r.leafId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-100 bg-white/80 px-3 py-2 text-xs dark:border-violet-900/60 dark:bg-zinc-950/80"
              >
                <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">
                  {breadcrumbFromPath(r.path)}
                </span>
                <Button type="button" size="xs" variant="outline" className="shrink-0" onClick={() => applyLeaf(r)}>
                  Apply
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(aiLoading || aiSuggestions.length > 0) && (
        <div className="rounded-lg border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50/80 p-4 dark:border-sky-900/60 dark:from-sky-950/40 dark:to-indigo-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-950 dark:text-sky-100">
            <Sparkles className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            Suggestions IA
          </div>
          <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-200/80">
            Analyse du titre et de la description — choisissez une ligne pour appliquer.
          </p>
          {aiLoading ? (
            <ul className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-sky-100/80 bg-white/60 px-3 py-3 dark:border-sky-900/40 dark:bg-zinc-950/50"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" aria-hidden />
                  <span className="text-xs text-sky-800/70 dark:text-sky-200/70">Analyse en cours…</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 space-y-2">
              {aiSuggestions.map((lp) => (
                <li
                  key={lp.leafId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-100 bg-white/90 px-3 py-2 text-xs dark:border-sky-900/50 dark:bg-zinc-950/80"
                >
                  <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">{lp.breadcrumb}</span>
                  <Button type="button" size="xs" variant="outline" className="shrink-0" onClick={() => applyLeaf(lp)}>
                    Apply
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {keywordOnly.length > 0 ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-4 dark:border-teal-900 dark:bg-teal-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950 dark:text-teal-100">
            Correspondances rapides
          </div>
          <p className="mt-1 text-xs text-teal-900/75 dark:text-teal-200/75">
            Correspondance locale (titre + description), sans catégories aléatoires.
          </p>
          <ul className="mt-3 space-y-2">
            {keywordOnly.map((lp) => (
              <li
                key={lp.leafId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-teal-100 bg-white/80 px-3 py-2 text-xs dark:border-teal-900/50 dark:bg-zinc-950/80"
              >
                <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">{lp.breadcrumb}</span>
                <Button type="button" size="xs" variant="outline" className="shrink-0" onClick={() => applyLeaf(lp)}>
                  Apply
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Label htmlFor="cat-search" className="text-zinc-800 dark:text-zinc-200">
          Search
        </Label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input
            id="cat-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="pl-9 pr-8"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {search.trim() ? (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
            {searchHits.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">No matches</p>
            ) : (
              <ul>
                {searchHits.map((lp) => (
                  <li key={lp.leafId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      onClick={() => {
                        applyLeaf(lp)
                        setSearch("")
                      }}
                    >
                      <span className="text-zinc-800 dark:text-zinc-200">{lp.breadcrumb}</span>
                      <span className="shrink-0 font-medium text-violet-600">Apply</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <p
          className="truncate rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
          title={breadcrumbTrail}
        >
          {breadcrumbTrail}
        </p>
        <div
          className={cn(
            "mt-1.5 grid w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950",
            visibleColumnCount === 1 && "grid-cols-1",
            visibleColumnCount === 2 && "grid-cols-1 sm:grid-cols-2",
            visibleColumnCount === 3 && "grid-cols-1 sm:grid-cols-3"
          )}
        >
          {([0, 1, 2] as const).slice(0, visibleColumnCount).map((colIdx) => {
            const ids = threeCols[colIdx]
            return (
              <div
                key={colIdx}
                className="min-w-0 border-b border-zinc-200 last:border-b-0 sm:border-b-0 sm:border-r sm:border-zinc-200 sm:last:border-r-0 dark:border-zinc-800"
              >
                <ul className="max-h-[min(42vh,14rem)] min-h-0 overflow-y-auto py-0.5 sm:min-h-[7.5rem]">
                  {ids.length === 0 ? (
                    <li className="px-2 py-4 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                      {colIdx === 0 ? "No categories" : "—"}
                    </li>
                  ) : (
                    ids.map((id) => {
                      const n = browse.nodes[id]
                      if (!n) return null
                      const child = Boolean(browse.childrenByParent[id]?.length)
                      const selectedInCol = chain[colIdx] === id
                      const isCommitted = value === id
                      const isPendingLeaf = columnPending?.leafId === id
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            title={n.name}
                            className={cn(
                              "flex w-full items-start justify-between gap-1.5 px-2 py-1.5 text-left text-xs leading-snug transition",
                              selectedInCol || isCommitted || isPendingLeaf
                                ? "bg-violet-100 text-violet-950 dark:bg-violet-900/50 dark:text-violet-50"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            )}
                            onClick={() => onColumnPick(colIdx as 0 | 1 | 2, id)}
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

      {columnPending ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-2.5 dark:border-violet-900 dark:bg-violet-950/40">
          <p className="min-w-0 truncate text-xs text-zinc-800 dark:text-zinc-200">
            {breadcrumbFromPath(columnPending.path)}
          </p>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => {
              onChange(columnPending.leafId, columnPending.path)
              setColumnPending(null)
            }}
          >
            Apply
          </Button>
        </div>
      ) : null}

      {columnPending ? null : value && browse.nodes[value] ? (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Leaf category applied.</p>
      ) : null}
    </div>
  )
}
