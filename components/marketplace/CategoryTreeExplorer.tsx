"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type TransitionStartFunction } from "react"
import { useTranslations } from "next-intl"
import useSWR, { preload } from "swr"

import { ChevronDown, ChevronRight, Grid3x3, LayoutGrid, Loader2 } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { TriDashSeparator } from "@/components/ui/tri-dash-separator"
import { affisellBrand } from "@/lib/affisell-brand"
import { chunkCategoryRoots } from "@/lib/category-tree-tiers"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function branchKey(parentId: string): string {
  return `/api/categories/branch?parentId=${encodeURIComponent(parentId)}`
}

function prefetchBranch(parentId: string): void {
  void preload(branchKey(parentId), fetcher)
}

function scheduleIdle(work: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(work, { timeout: 2400 })
    return
  }
  window.setTimeout(work, 120)
}

type RowVisualState = {
  active: boolean
  pending: boolean
  highlighted: boolean
}

function rowVisualState(
  id: string,
  activeCategoryId: string | null | undefined,
  pendingCategoryId: string | null
): RowVisualState {
  const active = activeCategoryId === id
  const pending = pendingCategoryId === id
  return { active, pending, highlighted: active || pending }
}

function categoryRowClasses(
  state: RowVisualState,
  inSheet: boolean,
  variant: "root" | "branch"
): string {
  const { active, pending, highlighted } = state
  if (variant === "root") {
    return cn(
      "group/root relative flex min-w-0 flex-1 items-center justify-between rounded-xl border px-2 py-2.5 text-left text-sm font-semibold transition-all duration-150 ease-out",
      "hover:-translate-y-px hover:border-violet-300/45 hover:bg-violet-500/[0.07] hover:shadow-md hover:shadow-violet-500/10",
      "active:translate-y-0 active:scale-[0.985]",
      highlighted
        ? inSheet
          ? "border-violet-400/55 bg-gradient-to-r from-violet-500/25 via-indigo-500/15 to-transparent text-violet-50 shadow-lg shadow-violet-900/25 ring-1 ring-violet-300/40"
          : "border-violet-400/50 bg-gradient-to-r from-violet-500/12 via-indigo-500/8 to-transparent text-violet-900 shadow-md shadow-violet-500/10 ring-1 ring-violet-400/35 dark:text-violet-100"
        : inSheet
          ? "border-transparent text-zinc-50 hover:text-violet-100"
          : "border-transparent text-zinc-900 dark:text-zinc-100",
      pending && "affisell-category-tree-row--pending"
    )
  }

  return cn(
    "affisell-category-tree-row relative flex min-w-0 flex-1 flex-col rounded-r-xl border-l-[3px] py-2 pr-3 pl-2.5 text-left text-sm transition-all duration-150 ease-out",
    "hover:-translate-y-px hover:shadow-sm",
    "active:translate-y-0 active:scale-[0.99]",
    active
      ? inSheet
        ? "border-violet-400 bg-violet-500/20 font-semibold text-violet-50 shadow-md shadow-violet-900/20"
        : "border-violet-500 bg-violet-500/10 font-semibold text-violet-950 shadow-sm dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-50"
      : pending
        ? inSheet
          ? "border-violet-400/70 bg-violet-500/12 font-medium text-violet-100 affisell-category-tree-row--pending"
          : "border-violet-400/70 bg-violet-500/[0.08] font-medium text-violet-900 affisell-category-tree-row--pending dark:text-violet-100"
        : inSheet
          ? "border-transparent text-zinc-200 hover:border-violet-500/40 hover:bg-white/[0.06]"
          : "border-transparent text-zinc-600 hover:border-violet-400/35 hover:bg-violet-500/[0.05] dark:text-zinc-400"
  )
}

export type CategoryTreeRoot = {
  id: string
  name: string
  icon: string
  slug: string
  order: number
  count: number
  fullPath?: string
  subcategories: {
    id: string
    name: string
    slug: string
    count: number
    fullPath?: string
  }[]
}

type BranchNode = {
  id: string
  name: string
  fullPath: string
  count: number
  hasChildren: boolean
  isLeaf: boolean
}

type Props = {
  onCategoryClick?: (categoryNodeId: string) => void
  onPrefetchCategory?: (categoryNodeId: string) => void
  onShowFullCatalog?: () => void
  activeCategoryId?: string | null
  catalogTotal?: number
  categoriesPayload?: {
    categories: CategoryTreeRoot[]
    catalogTotal?: number
  }
  /** Mobile bottom sheet — dark glass theme for readable contrast. */
  inSheet?: boolean
  startCategoryTransition?: TransitionStartFunction
  /** Router transition in flight — keeps pending row highlighted. */
  isNavigating?: boolean
}

function BranchChildren({
  parentId,
  depth,
  activeCategoryId,
  pendingCategoryId,
  expandedIds,
  onToggle,
  onSelect,
  onPrefetchCategory,
  inSheet,
}: {
  parentId: string
  depth: number
  activeCategoryId?: string | null
  pendingCategoryId: string | null
  expandedIds: ReadonlySet<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onPrefetchCategory?: (id: string) => void
  inSheet: boolean
}) {
  const { data, isLoading } = useSWR<{ nodes: BranchNode[] }>(branchKey(parentId), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
    keepPreviousData: true,
  })

  const pl = 12 + depth * 12

  if (isLoading && !data?.nodes?.length) {
    return (
      <div className="space-y-1.5 py-1" style={{ paddingLeft: pl }} aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-9 animate-pulse rounded-lg",
              inSheet ? "bg-violet-500/15" : "bg-violet-500/10 dark:bg-violet-500/15"
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    )
  }

  const nodes = data?.nodes ?? []
  if (nodes.length === 0) return null

  return (
    <>
      {nodes.map((node) => (
        <CategoryTreeNodeRow
          key={node.id}
          node={node}
          depth={depth}
          activeCategoryId={activeCategoryId}
          pendingCategoryId={pendingCategoryId}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
          onPrefetchCategory={onPrefetchCategory}
          inSheet={inSheet}
        />
      ))}
    </>
  )
}

function CategoryTreeNodeRow({
  node,
  depth,
  activeCategoryId,
  pendingCategoryId,
  expandedIds,
  onToggle,
  onSelect,
  onPrefetchCategory,
  inSheet,
}: {
  node: BranchNode
  depth: number
  activeCategoryId?: string | null
  pendingCategoryId: string | null
  expandedIds: ReadonlySet<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onPrefetchCategory?: (id: string) => void
  inSheet: boolean
}) {
  const expanded = expandedIds.has(node.id)
  const pl = 12 + depth * 12
  const visual = rowVisualState(node.id, activeCategoryId, pendingCategoryId)

  return (
    <div>
      <div className="flex items-stretch pr-2" style={{ paddingLeft: pl }}>
        {node.hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggle(node.id)}
            onMouseEnter={() => prefetchBranch(node.id)}
            onFocus={() => prefetchBranch(node.id)}
            className={cn(
              "flex shrink-0 items-center rounded-lg py-2 pr-1 pl-0.5 transition hover:bg-violet-500/10",
              inSheet ? "text-violet-400" : "text-zinc-400"
            )}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          aria-current={visual.active ? "true" : undefined}
          aria-busy={visual.pending ? true : undefined}
          onClick={() => onSelect(node.id)}
          onPointerDown={() => onPrefetchCategory?.(node.id)}
          onMouseEnter={() => onPrefetchCategory?.(node.id)}
          onFocus={() => onPrefetchCategory?.(node.id)}
          className={categoryRowClasses(visual, inSheet, "branch")}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{node.name}</span>
            {visual.pending ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" aria-hidden />
            ) : node.count > 0 ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition",
                  visual.highlighted
                    ? inSheet
                      ? "bg-violet-400/30 text-violet-50"
                      : "bg-violet-600/15 text-violet-800 dark:text-violet-100"
                    : inSheet
                      ? "bg-violet-500/20 text-violet-200"
                      : "bg-brand-muted text-brand"
                )}
              >
                {node.count}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              "mt-0.5 line-clamp-2 text-[10px] font-normal leading-snug",
              inSheet ? "text-zinc-500" : "text-zinc-500"
            )}
          >
            {node.fullPath}
          </span>
        </button>
      </div>
      {expanded && node.hasChildren ? (
        <BranchChildren
          parentId={node.id}
          depth={depth + 1}
          activeCategoryId={activeCategoryId}
          pendingCategoryId={pendingCategoryId}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
          onPrefetchCategory={onPrefetchCategory}
          inSheet={inSheet}
        />
      ) : null}
    </div>
  )
}

function CategoryTreeRootBlock({
  root,
  activeCategoryId,
  activeRoot,
  pendingCategoryId,
  expandedIds,
  toggle,
  onSelect,
  onPrefetchCategory,
  inSheet,
  t,
}: {
  root: CategoryTreeRoot
  activeCategoryId?: string | null
  activeRoot?: CategoryTreeRoot
  pendingCategoryId: string | null
  expandedIds: ReadonlySet<string>
  toggle: (id: string) => void
  onSelect: (id: string) => void
  onPrefetchCategory?: (id: string) => void
  inSheet: boolean
  t: ReturnType<typeof useTranslations<"marketplace.sidebar">>
}) {
  const rootExpanded = expandedIds.has(root.id) || activeRoot?.id === root.id
  const visual = rowVisualState(root.id, activeCategoryId, pendingCategoryId)

  return (
    <div className={cn("border-b", inSheet ? "border-white/10" : "border-border/80")}>
      <div className="flex items-center gap-0.5 px-1.5 py-0.5">
        <button
          type="button"
          aria-expanded={rootExpanded}
          onClick={() => toggle(root.id)}
          onMouseEnter={() => {
            prefetchBranch(root.id)
            for (const sub of root.subcategories) prefetchBranch(sub.id)
          }}
          onFocus={() => prefetchBranch(root.id)}
          className={cn(
            "shrink-0 rounded-lg p-2 transition hover:bg-violet-500/10",
            inSheet ? "text-violet-400" : "text-zinc-400",
            rootExpanded && (inSheet ? "text-violet-300" : "text-violet-600 dark:text-violet-400")
          )}
        >
          {rootExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-current={visual.active ? "true" : undefined}
          aria-busy={visual.pending ? true : undefined}
          onClick={() => onSelect(root.id)}
          onPointerDown={() => onPrefetchCategory?.(root.id)}
          onMouseEnter={() => onPrefetchCategory?.(root.id)}
          onFocus={() => onPrefetchCategory?.(root.id)}
          className={categoryRowClasses(visual, inSheet, "root")}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <CategoryGlyph
              name={root.name}
              slug={root.slug}
              fullPath={root.fullPath}
              icon={root.icon}
              size="sm"
              inSheet={inSheet}
            />
            <span className="truncate">{root.name}</span>
            {visual.pending ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" aria-hidden />
            ) : null}
          </span>
          {root.count > 0 ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                visual.highlighted
                  ? inSheet
                    ? "bg-violet-400/30 text-violet-50"
                    : "bg-violet-600/15 text-violet-900 dark:text-violet-100"
                  : inSheet
                    ? "bg-white/10 text-zinc-300"
                    : "text-zinc-500"
              )}
            >
              {root.count}
            </span>
          ) : null}
        </button>
      </div>

      {rootExpanded ? (
        <div className="pb-1">
          {root.subcategories.map((sub) => {
            const subExpanded = expandedIds.has(sub.id)
            const subVisual = rowVisualState(sub.id, activeCategoryId, pendingCategoryId)
            return (
              <div key={sub.id}>
                <div className="flex items-stretch pl-6 pr-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(sub.id)}
                    onMouseEnter={() => prefetchBranch(sub.id)}
                    onFocus={() => prefetchBranch(sub.id)}
                    className={cn(
                      "shrink-0 rounded-lg py-2 pr-1 pl-0.5 transition hover:bg-violet-500/10",
                      inSheet ? "text-violet-400" : "text-zinc-400"
                    )}
                    aria-label={t("expandBranch")}
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", subExpanded && "rotate-90")} />
                  </button>
                  <button
                    type="button"
                    aria-current={subVisual.active ? "true" : undefined}
                    aria-busy={subVisual.pending ? true : undefined}
                    onClick={() => onSelect(sub.id)}
                    onPointerDown={() => onPrefetchCategory?.(sub.id)}
                    onMouseEnter={() => onPrefetchCategory?.(sub.id)}
                    onFocus={() => onPrefetchCategory?.(sub.id)}
                    className={categoryRowClasses(subVisual, inSheet, "branch")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{sub.name}</span>
                      {subVisual.pending ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" aria-hidden />
                      ) : null}
                    </span>
                    {sub.fullPath ? (
                      <span className={cn("mt-0.5 line-clamp-2 text-[10px]", inSheet ? "text-zinc-500" : "text-zinc-500")}>
                        {sub.fullPath}
                      </span>
                    ) : null}
                  </button>
                </div>
                {subExpanded ? (
                  <BranchChildren
                    parentId={sub.id}
                    depth={2}
                    activeCategoryId={activeCategoryId}
                    pendingCategoryId={pendingCategoryId}
                    expandedIds={expandedIds}
                    onToggle={toggle}
                    onSelect={onSelect}
                    onPrefetchCategory={onPrefetchCategory}
                    inSheet={inSheet}
                  />
                ) : null}
              </div>
            )
          })}
          {root.subcategories.length === 0 ? (
            <BranchChildren
              parentId={root.id}
              depth={1}
              activeCategoryId={activeCategoryId}
              pendingCategoryId={pendingCategoryId}
              expandedIds={expandedIds}
              onToggle={toggle}
              onSelect={onSelect}
              onPrefetchCategory={onPrefetchCategory}
              inSheet={inSheet}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function CategoryTreeExplorer({
  onCategoryClick,
  onPrefetchCategory,
  onShowFullCatalog,
  activeCategoryId,
  catalogTotal,
  categoriesPayload,
  inSheet = false,
  startCategoryTransition,
  isNavigating = false,
}: Props) {
  const t = useTranslations("marketplace.sidebar")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        prefetchBranch(id)
      }
      return next
    })
  }, [])

  const expandForCategory = useCallback(
    (nodeId: string, roots: CategoryTreeRoot[]) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        for (const root of roots) {
          if (root.id === nodeId) {
            next.add(root.id)
            prefetchBranch(root.id)
            return next
          }
          const sub = root.subcategories.find((s) => s.id === nodeId)
          if (sub) {
            next.add(root.id)
            next.add(sub.id)
            prefetchBranch(root.id)
            prefetchBranch(sub.id)
            return next
          }
        }
        return next
      })
    },
    []
  )

  const onSelect = useCallback(
    (id: string) => {
      setPendingCategoryId(id)
      onPrefetchCategory?.(id)
      expandForCategory(id, categoriesPayload?.categories ?? [])
      setExpandedIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        prefetchBranch(id)
        return next
      })

      const run = () => onCategoryClick?.(id)
      if (startCategoryTransition) {
        startCategoryTransition(run)
      } else {
        run()
      }
    },
    [onCategoryClick, onPrefetchCategory, startCategoryTransition, expandForCategory, categoriesPayload?.categories]
  )

  const roots = categoriesPayload?.categories ?? []

  useEffect(() => {
    if (!activeCategoryId) return
    setPendingCategoryId((pending) => (pending === activeCategoryId ? null : pending))
    expandForCategory(activeCategoryId, roots)
  }, [activeCategoryId, roots, expandForCategory])

  useEffect(() => {
    if (!pendingCategoryId) return
    const timer = window.setTimeout(() => setPendingCategoryId(null), 12_000)
    return () => window.clearTimeout(timer)
  }, [pendingCategoryId])

  const activeRoot = useMemo(
    () => roots.find((r) => r.id === activeCategoryId || r.subcategories.some((s) => s.id === activeCategoryId)),
    [roots, activeCategoryId]
  )

  const rootTiers = useMemo(() => chunkCategoryRoots(roots), [roots])
  const showNavProgress = Boolean(isNavigating || pendingCategoryId)
  const prefetchedTreeKeyRef = useRef("")

  useEffect(() => {
    if (!roots.length) return
    const key = roots.map((r) => r.id).join("|")
    if (prefetchedTreeKeyRef.current === key) return
    prefetchedTreeKeyRef.current = key
    scheduleIdle(() => {
      for (const root of roots) {
        prefetchBranch(root.id)
        for (const sub of root.subcategories.slice(0, 12)) prefetchBranch(sub.id)
      }
    })
  }, [roots])

  if (!roots.length) {
    return (
      <aside
        className={cn(
          "rounded-2xl border p-4 lg:rounded-none lg:border-r",
          inSheet ? "border-white/10 bg-transparent" : "border-border bg-card"
        )}
      >
        <p className={cn("text-sm", inSheet ? "text-zinc-400" : "text-muted-foreground")}>{t("empty")}</p>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        "affisell-category-tree relative flex w-full shrink-0 flex-col overflow-y-auto rounded-2xl border",
        inSheet
          ? "max-h-none border-0 bg-transparent text-zinc-100"
          : "max-h-[min(32rem,60vh)] border-border bg-card lg:max-h-[calc(100vh-5.25rem)] lg:rounded-none lg:border-r lg:border-y-0 lg:border-l-0"
      )}
    >
      {showNavProgress ? (
        <div
          className="affisell-category-tree-nav-progress pointer-events-none absolute inset-x-0 top-0 z-20"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "sticky top-0 z-10 px-4 py-4",
          inSheet
            ? "rounded-t-xl border-b border-white/10 bg-gradient-to-r from-violet-950/90 via-indigo-950/90 to-violet-950/90"
            : affisellBrand.gradientBar
        )}
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white drop-shadow-sm">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          {t("title")}
        </h2>
        <p className="mt-1 text-[11px] font-medium text-violet-100/80">{t("genealogyHint")}</p>
      </div>

      <button
        type="button"
        onClick={() => onShowFullCatalog?.()}
        className={cn(
          "flex w-full items-center gap-2 border-b px-4 py-3 text-left text-sm font-semibold transition-all duration-150",
          "hover:-translate-y-px hover:bg-violet-500/[0.05] active:scale-[0.995]",
          inSheet ? "border-white/10" : "border-border/80",
          !activeCategoryId
            ? inSheet
              ? "bg-violet-500/20 text-violet-100"
              : "bg-violet-600/10 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200"
            : inSheet
              ? "text-zinc-200 hover:bg-white/[0.04]"
              : "text-zinc-700 hover:bg-muted/60 dark:text-zinc-200"
        )}
      >
        <LayoutGrid className={cn("h-4 w-4 shrink-0", inSheet ? "text-violet-300" : undefined)} aria-hidden />
        <span className="flex-1">{t("allCatalog")}</span>
        {(catalogTotal ?? categoriesPayload?.catalogTotal ?? 0) > 0 ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              inSheet ? "bg-violet-500/25 text-violet-100" : "bg-violet-600/15 text-violet-800 dark:text-violet-200"
            )}
          >
            {catalogTotal ?? categoriesPayload?.catalogTotal}
          </span>
        ) : null}
      </button>

      {rootTiers.map((tier, tierIndex) => (
        <Fragment key={`tier-${tierIndex}`}>
          {tierIndex > 0 ? (
            <TriDashSeparator compact inSheet={inSheet} className={cn(inSheet ? "px-3" : "px-2")} />
          ) : null}
          {tier.map((root) => (
            <CategoryTreeRootBlock
              key={root.id}
              root={root}
              activeCategoryId={activeCategoryId}
              activeRoot={activeRoot}
              pendingCategoryId={pendingCategoryId}
              expandedIds={expandedIds}
              toggle={toggle}
              onSelect={onSelect}
              onPrefetchCategory={onPrefetchCategory}
              inSheet={inSheet}
              t={t}
            />
          ))}
        </Fragment>
      ))}
    </aside>
  )
}
