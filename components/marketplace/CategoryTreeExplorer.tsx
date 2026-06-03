"use client"

import { useCallback, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"

import { ChevronDown, ChevronRight, Grid3x3, LayoutGrid, Loader2 } from "lucide-react"

import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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
  onShowFullCatalog?: () => void
  activeCategoryId?: string | null
  catalogTotal?: number
  categoriesPayload?: {
    categories: CategoryTreeRoot[]
    catalogTotal?: number
  }
  /** Mobile bottom sheet — drop sidebar max-height chrome. */
  inSheet?: boolean
}

function BranchChildren({
  parentId,
  depth,
  activeCategoryId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  parentId: string
  depth: number
  activeCategoryId?: string | null
  expandedIds: string[]
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}) {
  const { data, isLoading } = useSWR<{ nodes: BranchNode[] }>(
    `/api/categories/branch?parentId=${encodeURIComponent(parentId)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 pl-4 text-xs text-zinc-500" style={{ paddingLeft: 12 + depth * 12 }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

function CategoryTreeNodeRow({
  node,
  depth,
  activeCategoryId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  node: BranchNode
  depth: number
  activeCategoryId?: string | null
  expandedIds: string[]
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}) {
  const expanded = expandedIds.includes(node.id)
  const active = activeCategoryId === node.id
  const pl = 12 + depth * 12

  return (
    <div>
      <div className="flex items-stretch" style={{ paddingLeft: pl }}>
        {node.hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggle(node.id)}
            className="flex shrink-0 items-center py-2 pr-1 text-zinc-400"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          title={node.fullPath}
          onClick={() => onSelect(node.id)}
          className={cn(
            "flex min-w-0 flex-1 flex-col border-l-2 py-2 pr-3 text-left text-sm transition",
            active
              ? "border-buyer bg-buyer-muted/70 font-medium text-orange-950 dark:border-buyer dark:bg-buyer-muted dark:text-buyer-light"
              : "border-transparent text-zinc-600 hover:border-brand/30 hover:bg-brand-muted/40 dark:text-zinc-400"
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{node.name}</span>
            {node.count > 0 ? (
              <span className="shrink-0 rounded-full bg-brand-muted px-1.5 py-0.5 text-[10px] font-bold text-brand">
                {node.count}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 line-clamp-2 text-[10px] font-normal leading-snug text-zinc-500">
            {node.fullPath}
          </span>
        </button>
      </div>
      {expanded && node.hasChildren ? (
        <BranchChildren
          parentId={node.id}
          depth={depth + 1}
          activeCategoryId={activeCategoryId}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  )
}

export function CategoryTreeExplorer({
  onCategoryClick,
  onShowFullCatalog,
  activeCategoryId,
  catalogTotal,
  categoriesPayload,
  inSheet = false,
}: Props) {
  const t = useTranslations("marketplace.sidebar")
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const onSelect = useCallback(
    (id: string) => {
      onCategoryClick?.(id)
    },
    [onCategoryClick]
  )

  const roots = categoriesPayload?.categories ?? []

  const activeRoot = useMemo(
    () => roots.find((r) => r.id === activeCategoryId || r.subcategories.some((s) => s.id === activeCategoryId)),
    [roots, activeCategoryId]
  )

  if (!roots.length) {
    return (
      <aside className="rounded-2xl border border-border bg-card p-4 lg:rounded-none lg:border-r">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card",
        inSheet
          ? "max-h-none border-0 bg-transparent"
          : "max-h-[min(32rem,60vh)] lg:max-h-[calc(100vh-5.25rem)] lg:rounded-none lg:border-r lg:border-y-0 lg:border-l-0"
      )}
    >
      <div className={cn("sticky top-0 z-10 px-4 py-4", affisellBrand.gradientBar)}>
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white drop-shadow-sm">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          {t("title")}
        </h2>
        <p className="mt-1 text-[11px] font-medium text-white/80">{t("genealogyHint")}</p>
      </div>

      <button
        type="button"
        onClick={() => onShowFullCatalog?.()}
        className={cn(
          "flex w-full items-center gap-2 border-b border-border/80 px-4 py-3 text-left text-sm font-semibold transition",
          !activeCategoryId
            ? "bg-violet-600/10 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200"
            : "text-zinc-700 hover:bg-muted/60 dark:text-zinc-200"
        )}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">{t("allCatalog")}</span>
        {(catalogTotal ?? categoriesPayload?.catalogTotal ?? 0) > 0 ? (
          <span className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:text-violet-200">
            {catalogTotal ?? categoriesPayload?.catalogTotal}
          </span>
        ) : null}
      </button>

      {roots.map((root) => {
        const rootExpanded = expandedIds.includes(root.id) || activeRoot?.id === root.id
        const rootActive = activeCategoryId === root.id
        return (
          <div key={root.id} className="border-b border-border/80">
            <div className="flex items-center px-2">
              <button
                type="button"
                aria-expanded={rootExpanded}
                onClick={() => toggle(root.id)}
                className="shrink-0 p-2 text-zinc-400"
              >
                {rootExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <button
                type="button"
                title={root.fullPath ?? root.name}
                onClick={() => onSelect(root.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-between py-3 pr-3 text-left text-sm font-semibold",
                  rootActive ? "text-buyer" : "text-zinc-900 dark:text-zinc-100"
                )}
              >
                <span className="flex items-center gap-2">
                  <span>{root.icon}</span>
                  <span className="truncate">{root.name}</span>
                </span>
                {root.count > 0 ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-zinc-500">{root.count}</span>
                ) : null}
              </button>
            </div>

            {rootExpanded ? (
              <div className="pb-1">
                {root.subcategories.map((sub) => {
                  const subExpanded = expandedIds.includes(sub.id)
                  const subActive = activeCategoryId === sub.id
                  return (
                    <div key={sub.id}>
                      <div className="flex items-stretch pl-8">
                        <button
                          type="button"
                          onClick={() => toggle(sub.id)}
                          className="shrink-0 py-2 pr-1 text-zinc-400"
                          aria-label={t("expandBranch")}
                        >
                          <ChevronRight
                            className={cn("h-3.5 w-3.5 transition", subExpanded && "rotate-90")}
                          />
                        </button>
                        <button
                          type="button"
                          title={sub.fullPath ?? `${root.name} > ${sub.name}`}
                          onClick={() => onSelect(sub.id)}
                          className={cn(
                            "flex min-w-0 flex-1 flex-col border-l-2 py-2 pr-3 text-left text-sm",
                            subActive
                              ? "border-buyer bg-buyer-muted/70 font-medium"
                              : "border-transparent text-zinc-600 dark:text-zinc-400"
                          )}
                        >
                          <span className="truncate">{sub.name}</span>
                          {sub.fullPath ? (
                            <span className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">{sub.fullPath}</span>
                          ) : null}
                        </button>
                      </div>
                      {subExpanded ? (
                        <BranchChildren
                          parentId={sub.id}
                          depth={2}
                          activeCategoryId={activeCategoryId}
                          expandedIds={expandedIds}
                          onToggle={toggle}
                          onSelect={onSelect}
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
                    expandedIds={expandedIds}
                    onToggle={toggle}
                    onSelect={onSelect}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </aside>
  )
}
