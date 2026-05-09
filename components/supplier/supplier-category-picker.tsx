"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, Loader2, Search, Sparkles, X } from "lucide-react"

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
  /** OpenAI-ranked picks from live taxonomy (may be empty). */
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

  const hasChildren = useCallback(
    (id: string) => Boolean(browse?.childrenByParent[id]?.length),
    [browse]
  )

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
    if (!browse || !value) return
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

  const searchHits = useMemo(() => {
    if (!browse || !search.trim()) return []
    const q = search.trim().toLowerCase()
    return browse.leafPaths
      .filter((lp) => lp.breadcrumb.toLowerCase().includes(q))
      .slice(0, 50)
  }, [browse, search])

  const columns = useMemo(() => {
    if (!browse) return [] as string[][]
    const cols: string[][] = []
    cols.push(browse.rootIds)
    for (let i = 0; i < chain.length; i++) {
      const parent = chain[i]
      const kids = browse.childrenByParent[parent] ?? []
      if (kids.length > 0) {
        cols.push(kids)
      }
    }
    return cols
  }, [browse, chain])

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
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">No categories in the database yet.</p>
        <p className="mt-2 text-xs leading-relaxed opacity-90">
          Load the marketplace taxonomy by running the seed script from the project root (uses your{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-900/50">
            DATABASE_URL
          </code>
          ):
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-white/70 px-2 py-2 font-mono text-[11px] text-amber-950 dark:bg-zinc-950/80 dark:text-amber-50">
          npx prisma db seed
        </pre>
        <p className="mt-2 text-xs opacity-90">
          Or: <code className="font-mono">npm run seed</code> — then refresh this page.
        </p>
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
            aria-label="Dismiss recently used"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 pr-8 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            Recently used categories
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
            AI picks for this title
          </div>
          <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-200/80">
            Mapped to your real catalog (OpenAI). Refreshes as you type.
          </p>
          {aiLoading ? (
            <ul className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-sky-100/80 bg-white/60 px-3 py-3 dark:border-sky-900/40 dark:bg-zinc-950/50"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" aria-hidden />
                  <span className="text-xs text-sky-800/70 dark:text-sky-200/70">Analyzing title…</span>
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
            Quick keyword matches
          </div>
          <p className="mt-1 text-xs text-teal-900/75 dark:text-teal-200/75">
            Instant lexical matches on category paths (no API key required).
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
          Search categories
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
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">All categories</p>
        <p
          className="mt-1.5 truncate rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300"
          title={breadcrumbTrail}
        >
          {breadcrumbTrail}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Browse columns like TikTok Shop: tap a row with › to go deeper; a row without › selects that category.
        </p>
        <div className="mt-2 flex max-w-full gap-0 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
          {columns.map((ids, colIdx) => (
            <div
              key={colIdx}
              className="min-w-[176px] max-w-[240px] flex-1 border-r border-zinc-200 last:border-r-0 dark:border-zinc-800"
            >
              <ul className="max-h-72 min-h-[200px] overflow-y-auto py-1">
                {ids.map((id) => {
                  const n = browse.nodes[id]
                  if (!n) return null
                  const child = hasChildren(id)
                  const selectedInCol = chain[colIdx] === id
                  const isValue = value === id
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-1 px-2.5 py-2 text-left text-xs transition",
                          selectedInCol || isValue
                            ? "bg-violet-100 text-violet-950 dark:bg-violet-900/50 dark:text-violet-50"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        )}
                        onClick={() => {
                          const nextChain = [...chain.slice(0, colIdx), id]
                          if (child) {
                            setChain(nextChain)
                          } else {
                            const path = pathForChain(nextChain)
                            if (path) onChange(id, path)
                            setChain(nextChain)
                          }
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {n.icon ? `${n.icon} ` : ""}
                          {n.name}
                        </span>
                        {child ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden /> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {value && browse.nodes[value] ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Selected:{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {breadcrumbFromPath(chain.map((id) => ({ id, name: browse.nodes[id]?.name ?? id })))}
          </span>
        </p>
      ) : (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">Category is required.</p>
      )}
    </div>
  )
}
