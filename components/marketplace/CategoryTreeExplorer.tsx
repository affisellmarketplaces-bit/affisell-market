"use client"

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import useSWR, { preload } from "swr"

import { ChevronRight, Grid3x3, LayoutGrid, Loader2 } from "lucide-react"

import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { TriDashHandle } from "@/components/ui/tri-dash-handle"
import { TriDashSeparator } from "@/components/ui/tri-dash-separator"
import { affisellBrand } from "@/lib/affisell-brand"
import { buyerHaptic } from "@/lib/buyer-haptics"
import { allTiersCollapsed } from "@/lib/catalog-category-chrome"
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
  /** Router transition in flight — keeps pending row highlighted. */
  isNavigating?: boolean
  collapsedTiers?: readonly boolean[]
  onToggleTier?: (index: number) => void
  onFoldAllAisles?: () => void
  onUnfoldAllAisles?: () => void
  onRevealTier?: (index: number) => void
  /** Desktop: dock the category column for a product-only grid. */
  onProductFocus?: () => void
}

function isNodeUnderRoot(root: CategoryTreeRoot, nodeId: string): boolean {
  if (root.id === nodeId) return true
  return root.subcategories.some((sub) => sub.id === nodeId)
}

function collectRootDescendantIds(root: CategoryTreeRoot): string[] {
  return root.subcategories.map((s) => s.id)
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
  const t = useTranslations("marketplace.sidebar")
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
            aria-label={expanded ? t("collapseBranch") : t("expandBranch")}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.id)
            }}
            onMouseEnter={() => prefetchBranch(node.id)}
            onFocus={() => prefetchBranch(node.id)}
            className={cn(
              "flex shrink-0 items-center rounded-lg py-2 pr-1 pl-0.5 transition-all duration-150 hover:bg-violet-500/15 active:scale-90",
              inSheet ? "text-violet-400" : "text-zinc-400"
            )}
          >
            <ChevronRight
              className={cn(
              "h-3.5 w-3.5 transition-transform duration-100 ease-out", expanded && "rotate-90")}
            />
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

const CategoryTreeRootBlock = memo(function CategoryTreeRootBlock({
  root,
  activeCategoryId,
  activeRoot,
  pendingCategoryId,
  rootExpanded,
  expandedIds,
  toggle,
  onSelect,
  onPrefetchCategory,
  inSheet,
  t,
}: {
  root: CategoryTreeRoot
  activeCategoryId?: string | null
  /** Root containing the active category — styling only, never forces expand. */
  activeRoot?: CategoryTreeRoot
  pendingCategoryId: string | null
  rootExpanded: boolean
  expandedIds: ReadonlySet<string>
  toggle: (id: string) => void
  onSelect: (id: string) => void
  onPrefetchCategory?: (id: string) => void
  inSheet: boolean
  t: ReturnType<typeof useTranslations<"marketplace.sidebar">>
}) {
  const containsActive = activeRoot?.id === root.id
  const visual = rowVisualState(root.id, activeCategoryId, pendingCategoryId)

  return (
    <div className={cn("border-b", inSheet ? "border-white/10" : "border-border/80")}>
      <div className="flex items-center gap-0.5 px-1.5 py-0.5">
        <button
          type="button"
          aria-expanded={rootExpanded}
          aria-label={rootExpanded ? t("collapseBranch") : t("expandBranch")}
          onClick={(event) => {
            event.stopPropagation()
            toggle(root.id)
          }}
          onMouseEnter={() => {
            prefetchBranch(root.id)
            for (const sub of root.subcategories) prefetchBranch(sub.id)
          }}
          onFocus={() => prefetchBranch(root.id)}
          className={cn(
            "shrink-0 rounded-lg p-2 transition-all duration-150 hover:bg-violet-500/15 active:scale-90",
            inSheet ? "text-violet-400" : "text-zinc-400",
            rootExpanded && (inSheet ? "text-violet-300" : "text-violet-600 dark:text-violet-400")
          )}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-100 ease-out", rootExpanded && "rotate-90")}
          />
        </button>
        <button
          type="button"
          aria-current={visual.active ? "true" : undefined}
          aria-busy={visual.pending ? true : undefined}
          onClick={() => onSelect(root.id)}
          onPointerDown={() => onPrefetchCategory?.(root.id)}
          onMouseEnter={() => onPrefetchCategory?.(root.id)}
          onFocus={() => onPrefetchCategory?.(root.id)}
          className={cn(
            categoryRowClasses(visual, inSheet, "root"),
            containsActive && !visual.active && !visual.pending && "ring-1 ring-violet-400/25"
          )}
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
                    aria-expanded={subExpanded}
                    aria-label={subExpanded ? t("collapseBranch") : t("expandBranch")}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggle(sub.id)
                    }}
                    onMouseEnter={() => prefetchBranch(sub.id)}
                    onFocus={() => prefetchBranch(sub.id)}
                    className={cn(
                      "shrink-0 rounded-lg py-2 pr-1 pl-0.5 transition-all duration-150 hover:bg-violet-500/15 active:scale-90",
                      inSheet ? "text-violet-400" : "text-zinc-400"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-100 ease-out",
                        subExpanded && "rotate-90"
                      )}
                    />
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
}, categoryRootBlockEqual)

function categoryRootBlockEqual(
  prev: {
    root: CategoryTreeRoot
    activeCategoryId?: string | null
    activeRoot?: CategoryTreeRoot
    pendingCategoryId: string | null
    rootExpanded: boolean
    expandedIds: ReadonlySet<string>
    inSheet: boolean
  },
  next: typeof prev
): boolean {
  if (prev.root !== next.root) return false
  if (prev.activeCategoryId !== next.activeCategoryId) return false
  if (prev.pendingCategoryId !== next.pendingCategoryId) return false
  if (prev.inSheet !== next.inSheet) return false
  if (prev.rootExpanded !== next.rootExpanded) return false
  if (prev.activeRoot?.id !== next.activeRoot?.id) return false
  for (const sub of prev.root.subcategories) {
    if (prev.expandedIds.has(sub.id) !== next.expandedIds.has(sub.id)) return false
  }
  return true
}

export function CategoryTreeExplorer({
  onCategoryClick,
  onPrefetchCategory,
  onShowFullCatalog,
  activeCategoryId,
  catalogTotal,
  categoriesPayload,
  inSheet = false,
  isNavigating = false,
  collapsedTiers: collapsedTiersProp,
  onToggleTier,
  onFoldAllAisles,
  onUnfoldAllAisles,
  onRevealTier,
  onProductFocus,
}: Props) {
  const t = useTranslations("marketplace.sidebar")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [localCollapsedTiers, setLocalCollapsedTiers] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ])
  const collapsedTiers = collapsedTiersProp ?? localCollapsedTiers
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)
  const [, startToggleTransition] = useTransition()
  const lastTreeSyncKeyRef = useRef("")
  const rootsByIdRef = useRef(new Map<string, CategoryTreeRoot>())

  const roots = categoriesPayload?.categories ?? []

  useEffect(() => {
    rootsByIdRef.current = new Map(roots.map((root) => [root.id, root]))
  }, [roots])

  const toggleTier = useCallback(
    (index: number) => {
      buyerHaptic("tap")
      if (onToggleTier) {
        onToggleTier(index)
        return
      }
      setLocalCollapsedTiers((prev) => {
        const next: [boolean, boolean, boolean] = [prev[0], prev[1], prev[2]]
        next[index] = !next[index]
        return next
      })
    },
    [onToggleTier]
  )

  const toggle = useCallback((id: string) => {
    startToggleTransition(() => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
          const root = rootsByIdRef.current.get(id)
          if (root) {
            for (const subId of collectRootDescendantIds(root)) next.delete(subId)
          }
        } else {
          next.add(id)
          scheduleIdle(() => prefetchBranch(id))
        }
        return next
      })
    })
  }, [startToggleTransition])

  const expandForCategory = useCallback((nodeId: string, treeRoots: CategoryTreeRoot[]) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const root of treeRoots) {
        if (root.id === nodeId) {
          next.add(root.id)
          scheduleIdle(() => prefetchBranch(root.id))
          return next
        }
        const sub = root.subcategories.find((s) => s.id === nodeId)
        if (sub) {
          next.add(root.id)
          next.add(sub.id)
          scheduleIdle(() => {
            prefetchBranch(root.id)
            prefetchBranch(sub.id)
          })
          return next
        }
      }
      return next
    })
  }, [])

  const revealTierForNode = useCallback(
    (nodeId: string, treeRoots: CategoryTreeRoot[]) => {
      const tiers = chunkCategoryRoots(treeRoots)
      const idx = tiers.findIndex((tier) =>
        tier.some((root) => isNodeUnderRoot(root, nodeId) || root.id === nodeId)
      )
      if (idx < 0) return
      if (onRevealTier) {
        onRevealTier(idx)
        return
      }
      setLocalCollapsedTiers((prev) => {
        if (!prev[idx]) return prev
        const next: [boolean, boolean, boolean] = [prev[0], prev[1], prev[2]]
        next[idx] = false
        return next
      })
    },
    [onRevealTier]
  )

  const onSelect = useCallback(
    (id: string) => {
      setPendingCategoryId(id)
      onCategoryClick?.(id)
      scheduleIdle(() => {
        onPrefetchCategory?.(id)
        const treeRoots = categoriesPayload?.categories ?? []
        expandForCategory(id, treeRoots)
        revealTierForNode(id, treeRoots)
      })
    },
    [onCategoryClick, onPrefetchCategory, expandForCategory, revealTierForNode, categoriesPayload?.categories]
  )

  const treeSyncKey = useMemo(
    () => `${activeCategoryId ?? ""}:${roots.map((root) => root.id).join("|")}`,
    [activeCategoryId, roots]
  )

  useEffect(() => {
    if (!activeCategoryId || !roots.length) return
    setPendingCategoryId((pending) => (pending === activeCategoryId ? null : pending))
    if (lastTreeSyncKeyRef.current === treeSyncKey) return
    lastTreeSyncKeyRef.current = treeSyncKey
    expandForCategory(activeCategoryId, roots)
    revealTierForNode(activeCategoryId, roots)
  }, [activeCategoryId, treeSyncKey, roots, expandForCategory, revealTierForNode])

  useEffect(() => {
    if (!pendingCategoryId) return
    const timer = window.setTimeout(() => setPendingCategoryId(null), 12_000)
    return () => window.clearTimeout(timer)
  }, [pendingCategoryId])

  const activeRoot = useMemo(
    () =>
      roots.find(
        (root) => isNodeUnderRoot(root, activeCategoryId ?? "") || root.id === activeCategoryId
      ),
    [roots, activeCategoryId]
  )

  const rootTiers = useMemo(() => chunkCategoryRoots(roots), [roots])
  const aislesFolded = allTiersCollapsed(collapsedTiers, rootTiers.length)

  const onToggleAllAisles = useCallback(() => {
    buyerHaptic("tap")
    if (aislesFolded) {
      if (onUnfoldAllAisles) onUnfoldAllAisles()
      else setLocalCollapsedTiers([false, false, false])
      return
    }
    setExpandedIds(new Set())
    if (onFoldAllAisles) onFoldAllAisles()
    else setLocalCollapsedTiers([true, true, true])
  }, [aislesFolded, onFoldAllAisles, onUnfoldAllAisles])

  const onCloseAll = useCallback(() => {
    buyerHaptic("success")
    setExpandedIds(new Set())
    if (inSheet || !onProductFocus) {
      if (onFoldAllAisles) onFoldAllAisles()
      else setLocalCollapsedTiers([true, true, true])
      return
    }
    onProductFocus()
  }, [inSheet, onFoldAllAisles, onProductFocus])

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
          "sticky top-0 z-10 px-3 py-3 sm:px-4 sm:py-4",
          inSheet
            ? "rounded-t-xl border-b border-white/10 bg-gradient-to-r from-violet-950/90 via-indigo-950/90 to-violet-950/90"
            : affisellBrand.gradientBar
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white drop-shadow-sm">
              <Grid3x3 className="h-5 w-5 shrink-0" strokeWidth={3} />
              {t("title")}
            </h2>
            <p className="mt-1 text-[11px] font-medium text-violet-100/80">{t("genealogyHint")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onCloseAll}
              aria-label={t("closeAll")}
              className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-white/20 active:scale-95"
            >
              {t("closeAll")}
            </button>
            <TriDashHandle
              expanded={!aislesFolded}
              onClick={onToggleAllAisles}
              label={aislesFolded ? t("showCategories") : t("hideCategories")}
              inSheet={inSheet}
            />
          </div>
        </div>
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

      {aislesFolded ? (
        <p
          className={cn(
            "px-4 py-3 text-center text-[11px] font-medium",
            inSheet ? "text-zinc-400" : "text-zinc-500"
          )}
        >
          {t("aislesHidden")}
        </p>
      ) : (
        rootTiers.map((tier, tierIndex) => {
          const collapsed = collapsedTiers[tierIndex] === true
          const panelId = `affisell-aisle-tier-${tierIndex}`
          return (
            <Fragment key={`tier-${tierIndex}`}>
              <TriDashSeparator
                compact
                inSheet={inSheet}
                collapsed={collapsed}
                onToggle={() => toggleTier(tierIndex)}
                toggleLabel={collapsed ? t("tierToggleShow") : t("tierToggleHide")}
                controlsId={panelId}
                className={cn(inSheet ? "px-3" : "px-2")}
              />
              <div id={panelId} hidden={collapsed} className={cn(collapsed && "hidden")}>
                {tier.map((root) => (
                  <CategoryTreeRootBlock
                    key={root.id}
                    root={root}
                    activeCategoryId={activeCategoryId}
                    activeRoot={activeRoot}
                    pendingCategoryId={pendingCategoryId}
                    rootExpanded={expandedIds.has(root.id)}
                    expandedIds={expandedIds}
                    toggle={toggle}
                    onSelect={onSelect}
                    onPrefetchCategory={onPrefetchCategory}
                    inSheet={inSheet}
                    t={t}
                  />
                ))}
              </div>
            </Fragment>
          )
        })
      )}
    </aside>
  )
}
